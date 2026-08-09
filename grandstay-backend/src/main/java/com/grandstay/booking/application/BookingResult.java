package com.grandstay.booking.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.grandstay.shared.domain.ModelEnums.BookingStatus;

public record BookingResult(
        UUID id,
        String bookingNumber,
        BookingStatus status,
        Instant expectedCheckInAt,
        Instant expectedCheckOutAt,
        BigDecimal roomTotal,
        BigDecimal discountAmount,
        String currency,
        List<AllocatedRoom> rooms) {
    public record AllocatedRoom(UUID id, UUID roomId, BigDecimal quantity,
                                BigDecimal unitRate, BigDecimal roomCharge) {}
}
