package com.grandstay.booking.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.grandstay.shared.domain.ModelEnums.BookingSource;

public final class BookingCommands {
    private BookingCommands() {}

    public record CreateBooking(
            UUID customerId,
            UUID promotionId,
            BookingSource source,
            Instant expectedCheckInAt,
            Instant expectedCheckOutAt,
            int adults,
            int children,
            String specialRequests,
            String currency,
            boolean confirmImmediately,
            List<RoomSelection> rooms,
            List<GuestInput> guests) {
        public CreateBooking {
            rooms = rooms == null ? List.of() : List.copyOf(rooms);
            guests = guests == null ? List.of() : List.copyOf(guests);
        }
    }

    public record RoomSelection(UUID roomId, UUID ratePlanId, int adults, int children) {}

    public record GuestInput(UUID customerId, String fullName, boolean primary,
                             String nationality, java.time.LocalDate dateOfBirth) {}
}
