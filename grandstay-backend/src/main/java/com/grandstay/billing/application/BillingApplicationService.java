package com.grandstay.billing.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.grandstay.billing.domain.Invoice;
import com.grandstay.billing.domain.InvoiceItem;
import com.grandstay.billing.infrastructure.InvoiceItemRepository;
import com.grandstay.billing.infrastructure.InvoiceRepository;
import com.grandstay.booking.domain.Booking;
import com.grandstay.booking.domain.BookingGuest;
import com.grandstay.booking.domain.BookingRoom;
import com.grandstay.booking.domain.EarlyLateFeePolicy;
import com.grandstay.booking.domain.PricingService;
import com.grandstay.booking.infrastructure.BookingGuestRepository;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.booking.infrastructure.BookingRoomRepository;
import com.grandstay.payment.domain.Payment;
import com.grandstay.payment.infrastructure.PaymentRepository;
import com.grandstay.service.domain.BookingService;
import com.grandstay.service.infrastructure.BookingServiceRepository;
import com.grandstay.shared.domain.ModelEnums.InvoiceItemType;
import com.grandstay.shared.domain.ModelEnums.InvoiceStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentType;
import com.grandstay.shared.exception.BusinessException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BillingApplicationService {
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final BookingGuestRepository guestRepository;
    private final BookingServiceRepository bookingServiceRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceItemRepository itemRepository;
    private final PaymentRepository paymentRepository;
    private final EarlyLateFeePolicy feePolicy;
    private final PricingService pricingService;
    private final Clock clock;
    private final EntityManager entityManager;

    public BillingApplicationService(BookingRepository bookingRepository,
                                     BookingRoomRepository bookingRoomRepository,
                                     BookingGuestRepository guestRepository,
                                     BookingServiceRepository bookingServiceRepository,
                                     InvoiceRepository invoiceRepository,
                                     InvoiceItemRepository itemRepository,
                                     PaymentRepository paymentRepository,
                                     EarlyLateFeePolicy feePolicy,
                                     PricingService pricingService,
                                     Clock clock,
                                     EntityManager entityManager) {
        this.bookingRepository = bookingRepository;
        this.bookingRoomRepository = bookingRoomRepository;
        this.guestRepository = guestRepository;
        this.bookingServiceRepository = bookingServiceRepository;
        this.invoiceRepository = invoiceRepository;
        this.itemRepository = itemRepository;
        this.paymentRepository = paymentRepository;
        this.feePolicy = feePolicy;
        this.pricingService = pricingService;
        this.clock = clock;
        this.entityManager = entityManager;
    }

    @Transactional
    public BillingResult issueForCheckout(UUID bookingId) {
        if (invoiceRepository.findAllByBookingIdOrderByCreatedAtDesc(bookingId).stream()
                .anyMatch(invoice -> invoice.getStatus() != InvoiceStatus.VOID)) {
            throw BusinessException.conflict(com.grandstay.shared.exception.ErrorCode.DATA_CONFLICT,
                    "An active invoice already exists for this booking");
        }
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> BusinessException.notFound("Booking", bookingId));
        if (booking.getActualCheckInAt() == null || booking.getActualCheckOutAt() == null) {
            throw BusinessException.invalid("Actual check-in and check-out are required before billing");
        }
        List<BookingRoom> rooms = bookingRoomRepository.findAllByBookingId(bookingId);
        List<BookingService> services = bookingServiceRepository.findAllByBookingIdOrderByServiceAtAsc(bookingId);
        if (rooms.isEmpty()) throw BusinessException.invalid("Cannot invoice a booking without rooms");

        BigDecimal roomCharge = money(rooms.stream().map(BookingRoom::getRoomCharge)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal serviceCharge = money(services.stream()
                .map(service -> service.getUnitPrice().multiply(service.getQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        EarlyLateFeePolicy.Fee fees = feePolicy.calculate(booking.getExpectedCheckInAt(),
                booking.getActualCheckInAt(), booking.getExpectedCheckOutAt(),
                booking.getActualCheckOutAt(), roomCharge);
        BigDecimal extraFee = fees.total();
        BigDecimal preDiscount = money(roomCharge.add(serviceCharge).add(extraFee));
        BigDecimal discount = money(booking.getDiscountAmount().min(preDiscount));

        List<LineDraft> drafts = new ArrayList<>();
        rooms.forEach(room -> drafts.add(new LineDraft(InvoiceItemType.ROOM, room.getId(),
                "Room charge", room.getPricingUnit().name(), room.getQuantity(), room.getUnitRate(),
                room.getRoomCharge(), room.getTaxRate())));
        services.forEach(service -> drafts.add(new LineDraft(InvoiceItemType.SERVICE, service.getId(),
                service.getServiceName(), service.getUnit(), service.getQuantity(), service.getUnitPrice(),
                money(service.getUnitPrice().multiply(service.getQuantity())), service.getTaxRate())));
        if (fees.earlyCheckInFee().signum() > 0) drafts.add(feeLine("Early check-in fee", fees.earlyCheckInFee(), booking));
        if (fees.lateCheckOutFee().signum() > 0) drafts.add(feeLine("Late check-out fee", fees.lateCheckOutFee(), booking));

        List<CalculatedLine> lines = allocateDiscountAndTax(drafts, discount, preDiscount);
        BigDecimal tax = money(lines.stream().map(CalculatedLine::tax).reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal grandTotal = money(preDiscount.subtract(discount).add(tax));
        BookingGuest primaryGuest = guestRepository.findAllByBookingIdOrderByPrimaryDesc(bookingId).stream()
                .filter(BookingGuest::isPrimary).findFirst()
                .orElseThrow(() -> BusinessException.invalid("Primary guest is required for invoice"));

        Invoice invoice = new Invoice();
        invoice.setBookingId(bookingId);
        invoice.setStatus(netPaid(bookingId).compareTo(grandTotal) >= 0 ? InvoiceStatus.PAID : InvoiceStatus.ISSUED);
        invoice.setIssuedAt(clock.instant()); invoice.setDueAt(clock.instant().plus(Duration.ofDays(1)));
        invoice.setCustomerName(primaryGuest.getFullName()); invoice.setCurrency(booking.getCurrency());
        invoice.setRoomCharge(roomCharge); invoice.setServiceCharge(serviceCharge); invoice.setExtraFee(extraFee);
        invoice.setDiscountAmount(discount); invoice.setTaxAmount(tax); invoice.setGrandTotal(grandTotal);
        invoiceRepository.saveAndFlush(invoice);
        entityManager.refresh(invoice);

        int order = 0;
        List<InvoiceItem> items = new ArrayList<>();
        for (CalculatedLine line : lines) {
            InvoiceItem item = new InvoiceItem();
            item.setInvoiceId(invoice.getId()); item.setItemType(line.draft().type());
            item.setReferenceId(line.draft().referenceId()); item.setDescription(line.draft().description());
            item.setUnit(line.draft().unit()); item.setQuantity(line.draft().quantity());
            item.setUnitPrice(line.draft().unitPrice()); item.setDiscountAmount(line.discount());
            item.setTaxRate(line.draft().taxRate()); item.setTaxAmount(line.tax());
            item.setLineTotal(line.total()); item.setDisplayOrder(order++); item.setCreatedAt(clock.instant());
            items.add(item);
        }
        itemRepository.saveAll(items);
        return new BillingResult(invoice.getId(), invoice.getInvoiceNumber(), invoice.getStatus(), roomCharge,
                serviceCharge, extraFee, discount, tax, grandTotal, invoice.getCurrency());
    }

    private List<CalculatedLine> allocateDiscountAndTax(List<LineDraft> drafts, BigDecimal discount,
                                                         BigDecimal preDiscount) {
        List<CalculatedLine> result = new ArrayList<>();
        BigDecimal allocated = BigDecimal.ZERO.setScale(2);
        for (int index = 0; index < drafts.size(); index++) {
            LineDraft draft = drafts.get(index);
            BigDecimal lineDiscount;
            if (discount.signum() == 0) lineDiscount = BigDecimal.ZERO.setScale(2);
            else if (index == drafts.size() - 1) lineDiscount = money(discount.subtract(allocated));
            else {
                lineDiscount = money(discount.multiply(draft.base())
                        .divide(preDiscount, 8, RoundingMode.HALF_UP));
                allocated = allocated.add(lineDiscount);
            }
            BigDecimal taxable = money(draft.base().subtract(lineDiscount));
            BigDecimal tax = pricingService.percentage(taxable, draft.taxRate());
            result.add(new CalculatedLine(draft, lineDiscount, tax, money(taxable.add(tax))));
        }
        return result;
    }

    private LineDraft feeLine(String description, BigDecimal amount, Booking booking) {
        return new LineDraft(InvoiceItemType.EXTRA_FEE, null, description, "FEE", BigDecimal.ONE,
                amount, amount, booking.getTaxRate());
    }

    private BigDecimal money(BigDecimal value) { return pricingService.money(value); }

    private BigDecimal netPaid(UUID bookingId) {
        List<Payment> payments = paymentRepository.findAllByBookingId(bookingId);
        BigDecimal paid = payments.stream()
                .filter(payment -> payment.getPaymentType() == PaymentType.PAYMENT)
                .filter(payment -> List.of(PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED,
                        PaymentStatus.REFUNDED).contains(payment.getStatus()))
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunded = payments.stream()
                .filter(payment -> payment.getPaymentType() == PaymentType.REFUND)
                .filter(payment -> payment.getStatus() == PaymentStatus.COMPLETED)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return money(paid.subtract(refunded));
    }

    private record LineDraft(InvoiceItemType type, UUID referenceId, String description, String unit,
                             BigDecimal quantity, BigDecimal unitPrice, BigDecimal base, BigDecimal taxRate) {}
    private record CalculatedLine(LineDraft draft, BigDecimal discount, BigDecimal tax, BigDecimal total) {}
}
