package com.grandstay.booking.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.grandstay.billing.application.BillingApplicationService;
import com.grandstay.billing.application.BillingResult;
import com.grandstay.booking.domain.Booking;
import com.grandstay.booking.domain.BookingRoom;
import com.grandstay.booking.domain.BookingStatusPolicy;
import com.grandstay.booking.domain.EarlyLateFeePolicy;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.booking.infrastructure.BookingRoomRepository;
import com.grandstay.customer.infrastructure.CustomerRepository;
import com.grandstay.room.domain.Room;
import com.grandstay.room.infrastructure.RoomRepository;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.domain.ModelEnums.RoomOperationalStatus;
import com.grandstay.shared.domain.ModelEnums.IdentityVerificationStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingLifecycleService {
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final RoomRepository roomRepository;
    private final CustomerRepository customerRepository;
    private final BookingStatusPolicy statusPolicy;
    private final EarlyLateFeePolicy feePolicy;
    private final BillingApplicationService billingService;
    private final Clock clock;

    public BookingLifecycleService(BookingRepository bookingRepository,
                                   BookingRoomRepository bookingRoomRepository,
                                   RoomRepository roomRepository,
                                   CustomerRepository customerRepository,
                                   BookingStatusPolicy statusPolicy,
                                   EarlyLateFeePolicy feePolicy,
                                   BillingApplicationService billingService,
                                   Clock clock) {
        this.bookingRepository = bookingRepository;
        this.bookingRoomRepository = bookingRoomRepository;
        this.roomRepository = roomRepository;
        this.customerRepository = customerRepository;
        this.statusPolicy = statusPolicy;
        this.feePolicy = feePolicy;
        this.billingService = billingService;
        this.clock = clock;
    }

    @Transactional
    public CheckInResult checkIn(UUID bookingId, Instant requestedAt) {
        Instant checkInAt = requestedAt == null ? clock.instant() : requestedAt;
        if (checkInAt.isAfter(clock.instant().plusSeconds(300))) {
            throw BusinessException.invalid("Actual check-in cannot be in the future");
        }
        Booking booking = locked(bookingId);
        statusPolicy.requireTransition(booking.getStatus(), BookingStatus.CHECKED_IN);
        if (booking.getCustomerId() != null) {
            var customer = customerRepository.findById(booking.getCustomerId())
                    .filter(candidate -> candidate.getDeletedAt() == null)
                    .orElseThrow(() -> BusinessException.notFound("Customer", booking.getCustomerId()));
            if (customer.getIdentityVerificationStatus() != IdentityVerificationStatus.VERIFIED) {
                throw new BusinessException(ErrorCode.IDENTITY_REQUIRED, org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                        "Identity verification is required before check-in");
            }
        }
        if (!checkInAt.isBefore(booking.getExpectedCheckOutAt())) {
            throw BusinessException.invalid("Check-in must be before expected check-out");
        }
        List<BookingRoom> allocations = bookingRoomRepository.findAllByBookingId(bookingId);
        if (allocations.isEmpty()) throw BusinessException.invalid("Booking has no allocated rooms");
        for (BookingRoom allocation : allocations) {
            Room room = roomRepository.findById(allocation.getRoomId())
                    .orElseThrow(() -> BusinessException.notFound("Room", allocation.getRoomId()));
            if (room.getDeletedAt() != null || room.getOperationalStatus() != RoomOperationalStatus.AVAILABLE) {
                throw BusinessException.conflict(ErrorCode.ROOM_NOT_OPERATIONAL,
                        "Room " + room.getRoomNumber() + " is not ready for check-in");
            }
            allocation.setCheckedInAt(checkInAt);
        }
        booking.setActualCheckInAt(checkInAt);
        booking.setStatus(BookingStatus.CHECKED_IN);
        bookingRepository.saveAndFlush(booking);
        bookingRoomRepository.saveAll(allocations);
        BigDecimal roomTotal = allocations.stream().map(BookingRoom::getRoomCharge)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        EarlyLateFeePolicy.Fee fee = feePolicy.calculate(booking.getExpectedCheckInAt(), checkInAt,
                booking.getExpectedCheckOutAt(), booking.getExpectedCheckOutAt(), roomTotal);
        return new CheckInResult(bookingId, checkInAt, fee.earlyCheckInFee());
    }

    @Transactional
    public CheckOutResult checkOut(UUID bookingId, Instant requestedAt) {
        Instant checkOutAt = requestedAt == null ? clock.instant() : requestedAt;
        if (checkOutAt.isAfter(clock.instant().plusSeconds(300))) {
            throw BusinessException.invalid("Actual check-out cannot be in the future");
        }
        Booking booking = locked(bookingId);
        statusPolicy.requireTransition(booking.getStatus(), BookingStatus.CHECKED_OUT);
        if (booking.getActualCheckInAt() == null || !checkOutAt.isAfter(booking.getActualCheckInAt())) {
            throw BusinessException.invalid("Check-out must be after actual check-in");
        }
        List<BookingRoom> allocations = bookingRoomRepository.findAllByBookingId(bookingId);
        allocations.forEach(room -> room.setCheckedOutAt(checkOutAt));
        booking.setActualCheckOutAt(checkOutAt);
        booking.setStatus(BookingStatus.CHECKED_OUT);
        bookingRepository.saveAndFlush(booking);
        bookingRoomRepository.saveAll(allocations);
        BillingResult invoice = billingService.issueForCheckout(bookingId);
        return new CheckOutResult(bookingId, checkOutAt, invoice);
    }

    private Booking locked(UUID id) {
        return bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> BusinessException.notFound("Booking", id));
    }

    public record CheckInResult(UUID bookingId, Instant checkedInAt, BigDecimal earlyCheckInFee) {}
    public record CheckOutResult(UUID bookingId, Instant checkedOutAt, BillingResult invoice) {}
}
