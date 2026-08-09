package com.grandstay.payment.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.booking.domain.Booking;
import com.grandstay.booking.domain.BookingRoom;
import com.grandstay.booking.domain.PricingService;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.booking.infrastructure.BookingRoomRepository;
import com.grandstay.customer.application.CustomerIdentityService;
import com.grandstay.customer.domain.Customer;
import com.grandstay.payment.application.PaymentApplicationService.PaymentView;
import com.grandstay.payment.application.VnPayPaymentApplicationService.VnPayAvailability;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentMethod;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;
import com.grandstay.shared.domain.ModelEnums.PaymentStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentType;
import com.grandstay.shared.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SelfPaymentApplicationServiceTest {
    @Mock CustomerIdentityService identities;
    @Mock BookingRepository bookings;
    @Mock BookingRoomRepository rooms;
    @Mock PaymentApplicationService payments;
    @Mock VnPayPaymentApplicationService vnPay;

    private SelfPaymentApplicationService service;
    private UUID userId;
    private UUID customerId;
    private UUID bookingId;
    private Booking booking;

    @BeforeEach
    void setUp() {
        CustomerPaymentProperties properties = new CustomerPaymentProperties();
        properties.setDepositPercent(BigDecimal.valueOf(30));
        service = new SelfPaymentApplicationService(identities, bookings, rooms, payments, vnPay,
                properties, new PricingService());
        userId = UUID.randomUUID();
        customerId = UUID.randomUUID();
        bookingId = UUID.randomUUID();
        booking = new Booking();
        booking.setId(bookingId);
        booking.setCustomerId(customerId);
        booking.setBookingNumber("GS-TEST-1");
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setCurrency("VND");
        booking.setDiscountAmount(BigDecimal.ZERO.setScale(2));
        booking.setTaxRate(BigDecimal.ZERO.setScale(4));
    }

    @Test
    void calculatesDepositAndSubtractsCompletedRefunds() {
        arrangeOwnedBooking();
        BookingRoom room = new BookingRoom();
        room.setRoomCharge(new BigDecimal("1000000.00"));
        when(rooms.findAllByBookingId(bookingId)).thenReturn(List.of(room));
        UUID depositId = UUID.randomUUID();
        when(payments.byBooking(bookingId)).thenReturn(List.of(
                payment(depositId, null, PaymentType.PAYMENT, PaymentPurpose.DEPOSIT,
                        PaymentStatus.COMPLETED, new BigDecimal("300000.00")),
                payment(UUID.randomUUID(), depositId, PaymentType.REFUND, PaymentPurpose.REFUND,
                        PaymentStatus.COMPLETED, new BigDecimal("50000.00"))));
        when(vnPay.availability()).thenReturn(new VnPayAvailability(true, true, true));

        var quote = service.quote(userId, bookingId);

        assertThat(quote.estimatedTotal()).isEqualByComparingTo("1000000.00");
        assertThat(quote.requiredDeposit()).isEqualByComparingTo("300000.00");
        assertThat(quote.paidDeposit()).isEqualByComparingTo("250000.00");
        assertThat(quote.remainingDeposit()).isEqualByComparingTo("50000.00");
        assertThat(quote.vnpayEnabled()).isTrue();
        assertThat(quote.payments()).hasSize(2);
    }

    @Test
    void hidesAGetPaymentRequestForAnotherCustomersBooking() {
        Customer customer = customer();
        UUID paymentId = UUID.randomUUID();
        UUID foreignBookingId = UUID.randomUUID();
        when(identities.resolve(userId)).thenReturn(customer);
        when(payments.get(paymentId)).thenReturn(new PaymentView(paymentId, foreignBookingId, null,
                "PROVIDER-1", PaymentType.PAYMENT, PaymentPurpose.DEPOSIT, PaymentMethod.QR,
                PaymentStatus.PENDING, new BigDecimal("100000.00"), "VND", null,
                "ONLINE_PROVIDER", "GS-1", "REQ-1", null, null, null, Instant.now()));
        when(bookings.existsByIdAndCustomerId(foreignBookingId, customerId)).thenReturn(false);

        assertThatThrownBy(() -> service.get(userId, paymentId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not found");
    }

    private void arrangeOwnedBooking() {
        when(identities.resolve(userId)).thenReturn(customer());
        when(bookings.findById(bookingId)).thenReturn(Optional.of(booking));
    }

    private Customer customer() {
        Customer customer = new Customer();
        customer.setId(customerId);
        return customer;
    }

    private PaymentView payment(UUID id, UUID originalId, PaymentType type, PaymentPurpose purpose,
                                PaymentStatus status, BigDecimal amount) {
        return new PaymentView(id, bookingId, originalId, "PAY-" + id, type, purpose,
                PaymentMethod.QR, status, amount, "VND", status == PaymentStatus.COMPLETED
                ? Instant.now() : null, "ONLINE_PROVIDER", "GS-" + id, "REQ-" + id,
                null, null, null, Instant.now());
    }
}
