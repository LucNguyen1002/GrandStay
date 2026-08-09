package com.grandstay.booking.domain;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class BookingStatusPolicy {
    private static final Map<BookingStatus, Set<BookingStatus>> TRANSITIONS = transitions();

    public void requireTransition(BookingStatus from, BookingStatus to) {
        if (!TRANSITIONS.getOrDefault(from, Set.of()).contains(to)) {
            throw new BusinessException(ErrorCode.INVALID_STATE_TRANSITION, HttpStatus.CONFLICT,
                    "Booking cannot transition from " + from + " to " + to);
        }
    }

    private static Map<BookingStatus, Set<BookingStatus>> transitions() {
        Map<BookingStatus, Set<BookingStatus>> transitions = new EnumMap<>(BookingStatus.class);
        transitions.put(BookingStatus.PENDING, EnumSet.of(BookingStatus.CONFIRMED, BookingStatus.CANCELLED));
        transitions.put(BookingStatus.CONFIRMED, EnumSet.of(BookingStatus.CHECKED_IN,
                BookingStatus.CANCELLED, BookingStatus.NO_SHOW));
        transitions.put(BookingStatus.CHECKED_IN, EnumSet.of(BookingStatus.CHECKED_OUT));
        return Map.copyOf(transitions);
    }
}
