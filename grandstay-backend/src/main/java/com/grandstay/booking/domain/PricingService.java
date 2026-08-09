package com.grandstay.booking.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import com.grandstay.shared.domain.ModelEnums.PricingUnit;
import com.grandstay.shared.exception.BusinessException;
import org.springframework.stereotype.Service;

@Service
public class PricingService {
    public static final ZoneId HOTEL_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public Price calculateRoomCharge(Instant checkIn, Instant checkOut, PricingUnit unit,
                                     BigDecimal unitRate) {
        validatePeriod(checkIn, checkOut);
        if (unitRate == null || unitRate.signum() < 0) {
            throw BusinessException.invalid("Unit rate must be non-negative");
        }
        BigDecimal quantity = switch (unit) {
            case HOURLY -> BigDecimal.valueOf(ceilDiv(Duration.between(checkIn, checkOut).toMinutes(), 60));
            case DAILY -> BigDecimal.valueOf(ceilDiv(Duration.between(checkIn, checkOut).toMinutes(), 1_440));
            case NIGHTLY -> {
                LocalDate start = checkIn.atZone(HOTEL_ZONE).toLocalDate();
                LocalDate end = checkOut.atZone(HOTEL_ZONE).toLocalDate();
                yield BigDecimal.valueOf(Math.max(1, ChronoUnit.DAYS.between(start, end)));
            }
        };
        return new Price(quantity, money(unitRate.multiply(quantity)));
    }

    public BigDecimal percentage(BigDecimal amount, BigDecimal rate) {
        if (amount == null || rate == null) return BigDecimal.ZERO.setScale(2);
        return money(amount.multiply(rate).divide(HUNDRED, 8, RoundingMode.HALF_UP));
    }

    public BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public void validatePeriod(Instant checkIn, Instant checkOut) {
        if (checkIn == null || checkOut == null || !checkOut.isAfter(checkIn)) {
            throw BusinessException.invalid("Check-out must be after check-in");
        }
    }

    private long ceilDiv(long value, long divisor) {
        return Math.max(1, Math.floorDiv(value + divisor - 1, divisor));
    }

    public record Price(BigDecimal quantity, BigDecimal amount) {}
}
