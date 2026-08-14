package com.grandstay.booking.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.payment.domain.Payment;
import com.grandstay.payment.application.SelfPaymentApplicationService;
import com.grandstay.payment.infrastructure.PaymentRepository;
import com.grandstay.realtime.application.RealtimeUpdateHub;
import com.grandstay.shared.domain.ModelEnums.BookingSource;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;
import com.grandstay.shared.domain.ModelEnums.PaymentStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class BookingHoldExpirationService {
    private static final Logger log = LoggerFactory.getLogger(BookingHoldExpirationService.class);
    private static final String EXPIRATION_REASON = "Online booking expired before the required deposit was paid";

    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final BookingApplicationService bookingService;
    private final SelfPaymentApplicationService selfPayments;
    private final BookingHoldProperties properties;
    private final RealtimeUpdateHub realtime;
    private final Clock clock;
    private final TransactionTemplate transaction;

    public BookingHoldExpirationService(BookingRepository bookings, PaymentRepository payments,
                                        BookingApplicationService bookingService,
                                        SelfPaymentApplicationService selfPayments,
                                        BookingHoldProperties properties, RealtimeUpdateHub realtime,
                                        Clock clock, PlatformTransactionManager transactionManager) {
        this.bookings = bookings;
        this.payments = payments;
        this.bookingService = bookingService;
        this.selfPayments = selfPayments;
        this.properties = properties;
        this.realtime = realtime;
        this.clock = clock;
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Scheduled(fixedDelayString = "${grandstay.booking.hold-scan-delay:60000}")
    public void expireUnpaidOnlineBookings() {
        if (!properties.isHoldEnabled()) return;
        Instant now = clock.instant();
        Instant cutoff = now.minus(properties.getHoldDuration());
        List<UUID> candidates = bookings.findExpiredOnlineHoldIds(
                BookingSource.ONLINE, BookingStatus.CONFIRMED, cutoff, PageRequest.of(0, 100));
        boolean changed = false;
        for (UUID bookingId : candidates) {
            try {
                Boolean expired = transaction.execute(status -> expireOne(bookingId, now, cutoff));
                changed |= Boolean.TRUE.equals(expired);
            } catch (RuntimeException exception) {
                log.warn("Could not expire booking hold {}: {}", bookingId, exception.getMessage());
            }
        }
        if (changed) realtime.publish("bookings");
    }

    private boolean expireOne(UUID bookingId, Instant now, Instant cutoff) {
        // Payment completion and refund flows lock payment rows before the
        // booking. Keep the same lock order here to prevent a deadlock.
        List<Payment> history = payments.findAllByBookingIdForUpdate(bookingId);
        var booking = bookings.findByIdForUpdate(bookingId).orElse(null);
        if (booking == null || booking.getBookingSource() != BookingSource.ONLINE
                || booking.getStatus() != BookingStatus.CONFIRMED
                || booking.getCreatedAt().isAfter(cutoff)) return false;

        var quote = selfPayments.quoteForBooking(bookingId);
        if (quote.remainingDeposit().signum() <= 0) return false;

        boolean activePayment = history.stream().anyMatch(payment -> payment.getPaymentType() == PaymentType.PAYMENT
                && payment.getPurpose() == PaymentPurpose.DEPOSIT
                && payment.getStatus() == PaymentStatus.PENDING
                && payment.getCreatedAt().plus(properties.getHoldDuration()).isAfter(now));
        if (activePayment) return false;

        List<Payment> stalePayments = history.stream()
                .filter(payment -> payment.getPaymentType() == PaymentType.PAYMENT)
                .filter(payment -> payment.getPurpose() == PaymentPurpose.DEPOSIT)
                .filter(payment -> payment.getStatus() == PaymentStatus.PENDING)
                .toList();
        stalePayments.forEach(payment -> {
                    payment.setStatus(PaymentStatus.FAILED);
                    payment.setFailureReason("Booking hold expired");
                });
        payments.saveAll(stalePayments);
        bookingService.cancel(bookingId, EXPIRATION_REASON);
        return true;
    }
}
