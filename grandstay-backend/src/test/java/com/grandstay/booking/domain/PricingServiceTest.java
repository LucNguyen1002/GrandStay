package com.grandstay.booking.domain;

import java.math.BigDecimal;
import java.time.Instant;

import com.grandstay.shared.domain.ModelEnums.PricingUnit;
import com.grandstay.shared.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PricingServiceTest {
    private final PricingService service = new PricingService();

    @Test
    void roundsHourlyStayUpToStartedHour() {
        var price = service.calculateRoomCharge(Instant.parse("2030-01-01T00:00:00Z"),
                Instant.parse("2030-01-01T01:01:00Z"), PricingUnit.HOURLY, new BigDecimal("100.00"));
        assertThat(price.quantity()).isEqualByComparingTo("2");
        assertThat(price.amount()).isEqualByComparingTo("200.00");
    }

    @Test
    void countsNightsUsingHotelTimezoneCalendarDates() {
        var price = service.calculateRoomCharge(Instant.parse("2030-01-01T08:00:00Z"),
                Instant.parse("2030-01-03T03:00:00Z"), PricingUnit.NIGHTLY, new BigDecimal("750000"));
        assertThat(price.quantity()).isEqualByComparingTo("2");
        assertThat(price.amount()).isEqualByComparingTo("1500000.00");
    }

    @Test
    void rejectsInvalidPeriod() {
        Instant instant = Instant.parse("2030-01-01T00:00:00Z");
        assertThatThrownBy(() -> service.calculateRoomCharge(instant, instant,
                PricingUnit.DAILY, BigDecimal.ONE)).isInstanceOf(BusinessException.class);
    }
}
