package com.grandstay.booking.domain;

import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BookingStatusPolicyTest {
    private final BookingStatusPolicy policy = new BookingStatusPolicy();

    @Test
    void allowsExpectedLifecycle() {
        assertThatCode(() -> policy.requireTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED))
                .doesNotThrowAnyException();
        assertThatCode(() -> policy.requireTransition(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN))
                .doesNotThrowAnyException();
        assertThatCode(() -> policy.requireTransition(BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT))
                .doesNotThrowAnyException();
    }

    @Test
    void preventsReopeningCheckedOutBooking() {
        assertThatThrownBy(() -> policy.requireTransition(BookingStatus.CHECKED_OUT, BookingStatus.CONFIRMED))
                .isInstanceOf(BusinessException.class);
    }
}
