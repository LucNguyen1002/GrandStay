package com.grandstay.payment.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.billing.domain.Invoice;
import com.grandstay.billing.infrastructure.InvoiceRepository;
import com.grandstay.booking.domain.Booking;
import com.grandstay.booking.domain.BookingRoom;
import com.grandstay.booking.domain.PricingService;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.booking.infrastructure.BookingRoomRepository;
import com.grandstay.payment.application.PaymentCommands.RecordPayment;
import com.grandstay.payment.application.PaymentCommands.RefundPayment;
import com.grandstay.payment.domain.Payment;
import com.grandstay.payment.infrastructure.PaymentRepository;
import com.grandstay.shared.domain.ModelEnums.InvoiceStatus;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;
import com.grandstay.shared.domain.ModelEnums.PaymentMethod;
import com.grandstay.shared.domain.ModelEnums.PaymentStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentType;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentApplicationService {
    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final InvoiceRepository invoiceRepository;
    private final PricingService pricingService;
    private final Clock clock;

    public PaymentApplicationService(PaymentRepository paymentRepository,
                                     BookingRepository bookingRepository,
                                     BookingRoomRepository bookingRoomRepository,
                                     InvoiceRepository invoiceRepository,
                                     PricingService pricingService,
                                     Clock clock) {
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.bookingRoomRepository = bookingRoomRepository;
        this.invoiceRepository = invoiceRepository;
        this.pricingService = pricingService;
        this.clock = clock;
    }

    @Transactional
    public PaymentResult record(RecordPayment command) {
        return recordInternal(command, null, null, null, null);
    }

    @Transactional
    public PaymentResult recordProvider(RecordPayment command, String provider,
                                        String providerOrderId, String providerRequestId) {
        if (provider == null || provider.isBlank() || providerOrderId == null || providerOrderId.isBlank()
                || providerRequestId == null || providerRequestId.isBlank()) {
            throw BusinessException.invalid("Provider, provider order ID and provider request ID are required");
        }
        return recordInternal(command, provider.trim().toUpperCase(Locale.ROOT),
                providerOrderId.trim(), providerRequestId.trim(), null);
    }

    @Transactional
    public PaymentResult recordCustomerProvider(RecordPayment command, String provider,
                                                String providerOrderId, String providerRequestId,
                                                BigDecimal maximumDeposit) {
        if (command == null || command.purpose() != PaymentPurpose.DEPOSIT) {
            throw BusinessException.invalid("Customer provider payments must be deposits");
        }
        if (maximumDeposit == null || maximumDeposit.signum() <= 0) {
            throw BusinessException.invalid("A positive customer deposit limit is required");
        }
        if (provider == null || provider.isBlank() || providerOrderId == null || providerOrderId.isBlank()
                || providerRequestId == null || providerRequestId.isBlank()) {
            throw BusinessException.invalid("Provider, provider order ID and provider request ID are required");
        }
        return recordInternal(command, provider.trim().toUpperCase(Locale.ROOT),
                providerOrderId.trim(), providerRequestId.trim(), maximumDeposit);
    }

    private PaymentResult recordInternal(RecordPayment command, String provider,
                                         String providerOrderId, String providerRequestId,
                                         BigDecimal maximumDeposit) {
        validate(command);
        Booking booking = bookingRepository.findByIdForUpdate(command.bookingId())
                .orElseThrow(() -> BusinessException.notFound("Booking", command.bookingId()));
        String currency = command.currency().toUpperCase(Locale.ROOT);
        if (!booking.getCurrency().equalsIgnoreCase(currency)) {
            throw BusinessException.invalid("Payment and booking currencies must match");
        }
        if (paymentRepository.findByTransactionCode(command.transactionCode()).isPresent()) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT, "Transaction code already exists");
        }
        if (command.purpose() == PaymentPurpose.DEPOSIT) {
            requireDepositState(booking);
            BigDecimal limit = maximumDeposit == null ? estimatedBookingTotal(booking) : maximumDeposit;
            requireWithinDepositLimit(booking.getId(), command.amount(), limit);
        }
        if (command.purpose() != PaymentPurpose.DEPOSIT) {
            requireWithinBalance(booking.getId(), command.amount());
        }
        Payment payment = new Payment();
        payment.setBookingId(booking.getId()); payment.setTransactionCode(command.transactionCode().trim());
        payment.setPaymentType(PaymentType.PAYMENT); payment.setPurpose(command.purpose());
        payment.setMethod(command.method()); payment.setAmount(command.amount()); payment.setCurrency(currency);
        payment.setStatus(command.completed() ? PaymentStatus.COMPLETED : PaymentStatus.PENDING);
        payment.setPaidAt(command.completed() ? clock.instant() : null);
        payment.setProviderReference(command.providerReference()); payment.setNotes(command.notes());
        payment.setProvider(provider); payment.setProviderOrderId(providerOrderId);
        payment.setProviderRequestId(providerRequestId);
        payment = paymentRepository.save(payment);
        if (command.completed()) updateInvoiceStatuses(booking.getId());
        return result(payment, balance(booking.getId()));
    }

    @Transactional
    public PaymentResult complete(UUID paymentId) {
        Payment payment = locked(paymentId);
        if (payment.getStatus() != PaymentStatus.PENDING || payment.getPaymentType() != PaymentType.PAYMENT) {
            throw BusinessException.conflict(ErrorCode.INVALID_STATE_TRANSITION,
                    "Only a pending payment can be completed");
        }
        if (payment.getProvider() != null) {
            throw BusinessException.conflict(ErrorCode.INVALID_STATE_TRANSITION,
                    "Provider payments must be completed through a verified provider callback or reconciliation");
        }
        Booking booking = bookingRepository.findByIdForUpdate(payment.getBookingId())
                .orElseThrow(() -> BusinessException.notFound("Booking", payment.getBookingId()));
        if (payment.getPurpose() == PaymentPurpose.DEPOSIT) {
            requireDepositState(booking);
        } else {
            requireWithinBalance(payment.getBookingId(), payment.getAmount());
        }
        payment.setStatus(PaymentStatus.COMPLETED); payment.setPaidAt(clock.instant());
        paymentRepository.save(payment); updateInvoiceStatuses(payment.getBookingId());
        return result(payment, balance(payment.getBookingId()));
    }

    @Transactional
    public ProviderPayment settleProvider(String provider, String providerOrderId,
                                          String providerRequestId, BigDecimal amount,
                                          String providerReference) {
        Payment payment = lockedProvider(provider, providerOrderId);
        validateProviderCallback(payment, providerRequestId, amount);
        if (payment.getStatus() == PaymentStatus.COMPLETED) {
            if (providerReference != null && providerReference.equals(payment.getProviderReference())) {
                return providerResult(payment);
            }
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT,
                    "Payment was completed with another provider reference");
        }
        if (payment.getStatus() != PaymentStatus.PENDING
                || payment.getPaymentType() != PaymentType.PAYMENT) {
            throw BusinessException.conflict(ErrorCode.INVALID_STATE_TRANSITION,
                    "Provider payment cannot be completed from its current status");
        }
        Booking booking = bookingRepository.findByIdForUpdate(payment.getBookingId())
                .orElseThrow(() -> BusinessException.notFound("Booking", payment.getBookingId()));
        if (payment.getPurpose() == PaymentPurpose.DEPOSIT) {
            requireDepositState(booking);
        } else {
            requireWithinBalance(payment.getBookingId(), payment.getAmount());
        }
        payment.setStatus(PaymentStatus.COMPLETED);
        payment.setPaidAt(clock.instant());
        payment.setProviderReference(limit(providerReference, 150));
        payment.setFailureReason(null);
        paymentRepository.save(payment);
        updateInvoiceStatuses(payment.getBookingId());
        return providerResult(payment);
    }

    @Transactional
    public ProviderPayment failProvider(String provider, String providerOrderId,
                                        String providerRequestId, BigDecimal amount,
                                        String failureReason) {
        Payment payment = lockedProvider(provider, providerOrderId);
        validateProviderCallback(payment, providerRequestId, amount);
        if (payment.getStatus() == PaymentStatus.PENDING) {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setFailureReason(limit(failureReason, 500));
            paymentRepository.save(payment);
        }
        return providerResult(payment);
    }

    @Transactional
    public PaymentResult refund(RefundPayment command) {
        if (command == null || command.originalPaymentId() == null || command.transactionCode() == null
                || command.transactionCode().isBlank() || command.amount() == null || command.amount().signum() <= 0) {
            throw BusinessException.invalid("Original payment, transaction code and positive refund amount are required");
        }
        Payment original = locked(command.originalPaymentId());
        if (original.getPaymentType() != PaymentType.PAYMENT
                || !List.of(PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED).contains(original.getStatus())) {
            throw BusinessException.conflict(ErrorCode.INVALID_STATE_TRANSITION,
                    "Only a completed payment can be refunded");
        }
        if (original.getProvider() != null) {
            throw BusinessException.conflict(ErrorCode.INVALID_STATE_TRANSITION,
                    "Provider payments must be refunded through the provider workflow");
        }
        bookingRepository.findByIdForUpdate(original.getBookingId())
                .orElseThrow(() -> BusinessException.notFound("Booking", original.getBookingId()));
        if (paymentRepository.findByTransactionCode(command.transactionCode()).isPresent()) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT, "Transaction code already exists");
        }
        BigDecimal refunded = paymentRepository
                .findAllByOriginalPaymentIdAndStatus(original.getId(), PaymentStatus.COMPLETED).stream()
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (refunded.add(command.amount()).compareTo(original.getAmount()) > 0) {
            throw BusinessException.conflict(ErrorCode.REFUND_EXCEEDS_PAYMENT,
                    "Refund amount exceeds the remaining refundable amount");
        }
        Payment refund = new Payment();
        refund.setBookingId(original.getBookingId()); refund.setOriginalPaymentId(original.getId());
        refund.setTransactionCode(command.transactionCode().trim()); refund.setPaymentType(PaymentType.REFUND);
        refund.setPurpose(PaymentPurpose.REFUND); refund.setMethod(original.getMethod());
        refund.setStatus(PaymentStatus.COMPLETED); refund.setAmount(command.amount());
        refund.setCurrency(original.getCurrency()); refund.setPaidAt(clock.instant()); refund.setNotes(command.reason());
        refund = paymentRepository.save(refund);
        BigDecimal newRefunded = refunded.add(command.amount());
        original.setStatus(newRefunded.compareTo(original.getAmount()) == 0
                ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED);
        paymentRepository.save(original); updateInvoiceStatuses(original.getBookingId());
        return result(refund, balance(original.getBookingId()));
    }

    @Transactional(readOnly = true)
    public BalanceResult balance(UUID bookingId) {
        List<Invoice> invoices = invoiceRepository.findAllByBookingIdOrderByCreatedAtDesc(bookingId);
        BigDecimal invoiced = invoices.stream().filter(i -> i.getStatus() != InvoiceStatus.VOID)
                .map(Invoice::getGrandTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<Payment> payments = paymentRepository.findAllByBookingId(bookingId);
        BigDecimal paid = payments.stream().filter(p -> p.getPaymentType() == PaymentType.PAYMENT)
                .filter(p -> List.of(PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED,
                        PaymentStatus.REFUNDED).contains(p.getStatus()))
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunded = payments.stream().filter(p -> p.getPaymentType() == PaymentType.REFUND)
                .filter(p -> p.getStatus() == PaymentStatus.COMPLETED)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal netPaid = paid.subtract(refunded).setScale(2);
        return new BalanceResult(invoiced.setScale(2), netPaid,
                invoiced.subtract(netPaid).max(BigDecimal.ZERO).setScale(2));
    }

    @Transactional(readOnly = true)
    public List<PaymentView> byBooking(UUID bookingId) {
        if (!bookingRepository.existsById(bookingId)) {
            throw BusinessException.notFound("Booking", bookingId);
        }
        return paymentRepository.findAllByBookingIdOrderByCreatedAtDesc(bookingId).stream()
                .map(this::view)
                .toList();
    }

    @Transactional(readOnly = true)
    public PaymentView get(UUID paymentId) {
        return view(paymentRepository.findById(paymentId)
                .orElseThrow(() -> BusinessException.notFound("Payment", paymentId)));
    }

    @Transactional(readOnly = true)
    public Optional<ProviderPayment> findProvider(String provider, String providerOrderId) {
        return paymentRepository.findByProviderAndProviderOrderId(
                        provider.toUpperCase(Locale.ROOT), providerOrderId)
                .map(this::providerResult);
    }

    private void updateInvoiceStatuses(UUID bookingId) {
        BalanceResult balance = balance(bookingId);
        InvoiceStatus status = balance.outstanding().signum() == 0 ? InvoiceStatus.PAID : InvoiceStatus.ISSUED;
        List<Invoice> invoices = invoiceRepository.findAllByBookingIdOrderByCreatedAtDesc(bookingId);
        invoices.stream().filter(i -> i.getStatus() != InvoiceStatus.VOID).forEach(i -> i.setStatus(status));
        invoiceRepository.saveAll(invoices);
    }

    private void requireWithinBalance(UUID bookingId, BigDecimal amount) {
        BalanceResult balance = balance(bookingId);
        if (balance.invoiced().signum() == 0) {
            throw BusinessException.conflict(ErrorCode.PAYMENT_EXCEEDS_BALANCE,
                    "A settlement payment requires an issued invoice");
        }
        if (amount.compareTo(balance.outstanding()) > 0) {
            throw BusinessException.conflict(ErrorCode.PAYMENT_EXCEEDS_BALANCE,
                    "Payment amount exceeds outstanding balance");
        }
    }

    private void requireWithinDepositLimit(UUID bookingId, BigDecimal amount, BigDecimal maximumDeposit) {
        List<Payment> existing = paymentRepository.findAllByBookingId(bookingId);
        List<Payment> deposits = existing.stream()
                .filter(payment -> payment.getPaymentType() == PaymentType.PAYMENT)
                .filter(payment -> payment.getPurpose() == PaymentPurpose.DEPOSIT)
                .filter(payment -> List.of(PaymentStatus.PENDING, PaymentStatus.COMPLETED,
                        PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED)
                        .contains(payment.getStatus()))
                .toList();
        var depositIds = deposits.stream().map(Payment::getId).collect(java.util.stream.Collectors.toSet());
        BigDecimal committed = deposits.stream().map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunded = existing.stream()
                .filter(payment -> payment.getPaymentType() == PaymentType.REFUND)
                .filter(payment -> payment.getStatus() == PaymentStatus.COMPLETED)
                .filter(payment -> payment.getOriginalPaymentId() != null
                        && depositIds.contains(payment.getOriginalPaymentId()))
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (committed.subtract(refunded).add(amount).compareTo(maximumDeposit) > 0) {
            throw BusinessException.conflict(ErrorCode.PAYMENT_EXCEEDS_BALANCE,
                    "Customer deposit would exceed the allowed amount");
        }
    }

    private void requireDepositState(Booking booking) {
        if (!List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN)
                .contains(booking.getStatus())) {
            throw BusinessException.conflict(ErrorCode.INVALID_STATE_TRANSITION,
                    "A deposit cannot be recorded for this booking status");
        }
    }

    private BigDecimal estimatedBookingTotal(Booking booking) {
        BigDecimal subtotal = pricingService.money(bookingRoomRepository.findAllByBookingId(booking.getId()).stream()
                .map(BookingRoom::getRoomCharge).reduce(BigDecimal.ZERO, BigDecimal::add));
        if (subtotal.signum() <= 0) throw BusinessException.invalid("Cannot calculate a deposit without rooms");
        BigDecimal discount = pricingService.money(booking.getDiscountAmount().min(subtotal));
        BigDecimal taxable = pricingService.money(subtotal.subtract(discount));
        return pricingService.money(taxable.add(pricingService.percentage(taxable, booking.getTaxRate())));
    }

    private Payment locked(UUID id) {
        return paymentRepository.findByIdForUpdate(id)
                .orElseThrow(() -> BusinessException.notFound("Payment", id));
    }

    private Payment lockedProvider(String provider, String providerOrderId) {
        return paymentRepository.findByProviderAndProviderOrderIdForUpdate(
                        provider.toUpperCase(Locale.ROOT), providerOrderId)
                .orElseThrow(() -> BusinessException.notFound("Provider payment", providerOrderId));
    }

    private void validateProviderCallback(Payment payment, String providerRequestId, BigDecimal amount) {
        if (providerRequestId == null || !providerRequestId.equals(payment.getProviderRequestId())) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT, "Provider request ID does not match");
        }
        if (amount == null || amount.compareTo(payment.getAmount()) != 0) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT, "Provider payment amount does not match");
        }
    }

    private void validate(RecordPayment command) {
        if (command == null || command.bookingId() == null || command.transactionCode() == null
                || command.transactionCode().isBlank() || command.purpose() == null || command.method() == null
                || command.amount() == null || command.amount().signum() <= 0
                || command.currency() == null || !command.currency().matches("[A-Za-z]{3}")) {
            throw BusinessException.invalid("Booking, transaction code, purpose, method, positive amount and currency are required");
        }
    }

    private PaymentResult result(Payment payment, BalanceResult balance) {
        return new PaymentResult(payment.getId(), payment.getTransactionCode(), payment.getPaymentType(),
                payment.getStatus(), payment.getAmount(), payment.getCurrency(), balance);
    }

    private PaymentView view(Payment payment) {
        return new PaymentView(payment.getId(), payment.getBookingId(), payment.getOriginalPaymentId(),
                payment.getTransactionCode(), payment.getPaymentType(), payment.getPurpose(),
                payment.getMethod(), payment.getStatus(), payment.getAmount(), payment.getCurrency(),
                payment.getPaidAt(), payment.getProvider(), payment.getProviderOrderId(),
                payment.getProviderRequestId(), payment.getProviderReference(), payment.getFailureReason(),
                payment.getNotes(), payment.getCreatedAt());
    }

    private ProviderPayment providerResult(Payment payment) {
        return new ProviderPayment(payment.getId(), payment.getBookingId(), payment.getProviderOrderId(),
                payment.getProviderRequestId(), payment.getAmount(), payment.getCurrency(),
                payment.getStatus(), payment.getProviderReference());
    }

    private static String limit(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    public record BalanceResult(BigDecimal invoiced, BigDecimal netPaid, BigDecimal outstanding) {}
    public record PaymentView(UUID id, UUID bookingId, UUID originalPaymentId, String transactionCode,
                              PaymentType type, PaymentPurpose purpose, PaymentMethod method,
                              PaymentStatus status, BigDecimal amount, String currency, Instant paidAt,
                              String provider, String providerOrderId, String providerRequestId,
                              String providerReference, String failureReason, String notes, Instant createdAt) {}
    public record PaymentResult(UUID id, String transactionCode, PaymentType type, PaymentStatus status,
                                BigDecimal amount, String currency, BalanceResult balance) {}
    public record ProviderPayment(UUID paymentId, UUID bookingId, String providerOrderId,
                                  String providerRequestId, BigDecimal amount, String currency,
                                  PaymentStatus status, String providerReference) {}
}
