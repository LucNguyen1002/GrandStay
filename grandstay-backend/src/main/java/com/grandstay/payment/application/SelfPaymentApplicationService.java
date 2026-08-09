package com.grandstay.payment.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.grandstay.booking.domain.Booking;
import com.grandstay.booking.domain.BookingRoom;
import com.grandstay.booking.domain.PricingService;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.booking.infrastructure.BookingRoomRepository;
import com.grandstay.customer.application.CustomerIdentityService;
import com.grandstay.customer.domain.Customer;
import com.grandstay.payment.application.PaymentApplicationService.PaymentView;
import com.grandstay.payment.application.PaymentApplicationService.ProviderPayment;
import com.grandstay.payment.application.VnPayPaymentApplicationService.VnPayCheckout;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;
import com.grandstay.shared.domain.ModelEnums.PaymentStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentType;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SelfPaymentApplicationService {
    private static final Set<PaymentStatus> PAID_STATUSES = Set.of(
            PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED);

    private final CustomerIdentityService identities;
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository roomRepository;
    private final PaymentApplicationService payments;
    private final VnPayPaymentApplicationService vnPay;
    private final CustomerPaymentProperties properties;
    private final PricingService pricing;

    public SelfPaymentApplicationService(CustomerIdentityService identities,
                                         BookingRepository bookingRepository,
                                         BookingRoomRepository roomRepository,
                                         PaymentApplicationService payments,
                                         VnPayPaymentApplicationService vnPay,
                                         CustomerPaymentProperties properties,
                                         PricingService pricing) {
        this.identities = identities;
        this.bookingRepository = bookingRepository;
        this.roomRepository = roomRepository;
        this.payments = payments;
        this.vnPay = vnPay;
        this.properties = properties;
        this.pricing = pricing;
    }

    @Transactional
    public DepositQuote quote(UUID userId, UUID bookingId) {
        return quote(requireOwnedBooking(userId, bookingId));
    }

    @Transactional
    public PaymentView get(UUID userId, UUID paymentId) {
        Customer customer = identities.resolve(userId);
        PaymentView payment = payments.get(paymentId);
        requireOwned(payment.bookingId(), customer.getId());
        return payment;
    }

    public VnPayCheckout createVnPayDeposit(UUID userId, UUID bookingId, String clientIpAddress) {
        DepositQuote quote = quote(userId, bookingId);
        if (quote.bookingStatus() != BookingStatus.CONFIRMED) {
            throw BusinessException.conflict(ErrorCode.INVALID_STATE_TRANSITION,
                    "Only a confirmed booking can accept an online deposit");
        }
        if (!quote.vnpayEnabled()) {
            throw BusinessException.conflict(ErrorCode.VNPAY_PAYMENT_UNAVAILABLE,
                    "VNPay payment is currently unavailable");
        }
        if (quote.remainingDeposit().signum() <= 0) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT,
                    "The required deposit has already been paid");
        }
        if (quote.hasPendingPayment()) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT,
                    "An online deposit is already pending; reconcile it before trying again");
        }
        return vnPay.createCustomerDeposit(bookingId, quote.remainingDeposit(),
                quote.requiredDeposit(), clientIpAddress);
    }

    @Transactional
    public ProviderPayment reconcileVnPay(UUID userId, UUID paymentId) {
        Customer customer = identities.resolve(userId);
        PaymentView payment = payments.get(paymentId);
        requireOwned(payment.bookingId(), customer.getId());
        return vnPay.reconcile(paymentId);
    }

    private DepositQuote quote(Booking booking) {
        List<BookingRoom> rooms = roomRepository.findAllByBookingId(booking.getId());
        if (rooms.isEmpty()) throw BusinessException.invalid("Cannot calculate a deposit without rooms");

        BigDecimal roomSubtotal = pricing.money(rooms.stream().map(BookingRoom::getRoomCharge)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal discount = pricing.money(booking.getDiscountAmount().min(roomSubtotal));
        BigDecimal taxable = pricing.money(roomSubtotal.subtract(discount));
        BigDecimal estimatedTax = pricing.percentage(taxable, booking.getTaxRate());
        BigDecimal estimatedTotal = pricing.money(taxable.add(estimatedTax));
        BigDecimal requiredDeposit = wholeVnd(estimatedTotal.multiply(properties.getDepositPercent())
                .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP));

        List<PaymentView> history = payments.byBooking(booking.getId());
        Set<UUID> depositIds = history.stream()
                .filter(payment -> payment.type() == PaymentType.PAYMENT)
                .filter(payment -> payment.purpose() == PaymentPurpose.DEPOSIT)
                .filter(payment -> PAID_STATUSES.contains(payment.status()))
                .map(PaymentView::id).collect(java.util.stream.Collectors.toSet());
        BigDecimal grossDeposit = history.stream()
                .filter(payment -> depositIds.contains(payment.id()))
                .map(PaymentView::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refundedDeposit = history.stream()
                .filter(payment -> payment.type() == PaymentType.REFUND)
                .filter(payment -> payment.status() == PaymentStatus.COMPLETED)
                .filter(payment -> payment.originalPaymentId() != null
                        && depositIds.contains(payment.originalPaymentId()))
                .map(PaymentView::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paidDeposit = pricing.money(grossDeposit.subtract(refundedDeposit).max(BigDecimal.ZERO));
        BigDecimal remaining = wholeVnd(requiredDeposit.subtract(paidDeposit).max(BigDecimal.ZERO));
        boolean pending = history.stream().anyMatch(payment -> payment.type() == PaymentType.PAYMENT
                && payment.purpose() == PaymentPurpose.DEPOSIT
                && payment.status() == PaymentStatus.PENDING);

        List<SelfPaymentView> visibleHistory = history.stream()
                .filter(payment -> payment.purpose() == PaymentPurpose.DEPOSIT
                        || (payment.type() == PaymentType.REFUND && payment.originalPaymentId() != null
                        && depositIds.contains(payment.originalPaymentId())))
                .map(SelfPaymentView::from)
                .toList();
        return new DepositQuote(booking.getId(), booking.getBookingNumber(), booking.getStatus(),
                roomSubtotal, discount, estimatedTax, estimatedTotal, properties.getDepositPercent(),
                requiredDeposit, paidDeposit, remaining, booking.getCurrency(),
                vnPay.availability().enabled(), pending, visibleHistory);
    }

    private Booking requireOwnedBooking(UUID userId, UUID bookingId) {
        Customer customer = identities.resolve(userId);
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> BusinessException.notFound("Booking", bookingId));
        if (!customer.getId().equals(booking.getCustomerId())) {
            throw BusinessException.notFound("Booking", bookingId);
        }
        return booking;
    }

    private void requireOwned(UUID bookingId, UUID customerId) {
        if (bookingId == null || !bookingRepository.existsByIdAndCustomerId(bookingId, customerId)) {
            throw BusinessException.notFound("Payment", bookingId);
        }
    }

    private BigDecimal wholeVnd(BigDecimal amount) {
        return amount.setScale(0, RoundingMode.HALF_UP).setScale(2);
    }

    public record DepositQuote(UUID bookingId, String bookingNumber, BookingStatus bookingStatus,
                               BigDecimal roomSubtotal, BigDecimal discountAmount,
                               BigDecimal estimatedTax, BigDecimal estimatedTotal,
                               BigDecimal depositPercent, BigDecimal requiredDeposit,
                               BigDecimal paidDeposit, BigDecimal remainingDeposit,
                               String currency, boolean vnpayEnabled, boolean hasPendingPayment,
                               List<SelfPaymentView> payments) {}

    public record SelfPaymentView(UUID id, UUID originalPaymentId, String transactionCode,
                                  PaymentType type, PaymentPurpose purpose,
                                  com.grandstay.shared.domain.ModelEnums.PaymentMethod method,
                                  PaymentStatus status, BigDecimal amount, String currency,
                                  java.time.Instant paidAt, String providerReference,
                                  String failureReason, java.time.Instant createdAt) {
        private static SelfPaymentView from(PaymentView payment) {
            return new SelfPaymentView(payment.id(), payment.originalPaymentId(),
                    payment.transactionCode(), payment.type(), payment.purpose(), payment.method(),
                    payment.status(), payment.amount(), payment.currency(), payment.paidAt(),
                    payment.providerReference(), payment.failureReason(), payment.createdAt());
        }
    }
}
