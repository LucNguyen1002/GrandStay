package com.grandstay.booking.domain;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;

import com.grandstay.booking.application.HotelPolicyProperties;
import org.springframework.stereotype.Component;

@Component
public class EarlyLateFeePolicy {
    private final HotelPolicyProperties properties;
    private final PricingService pricingService;

    public EarlyLateFeePolicy(HotelPolicyProperties properties, PricingService pricingService) {
        this.properties = properties;
        this.pricingService = pricingService;
    }

    public Fee calculate(Instant expectedCheckIn, Instant actualCheckIn,
                         Instant expectedCheckOut, Instant actualCheckOut,
                         BigDecimal roomCharge) {
        BigDecimal early = feeFor(Duration.between(actualCheckIn, expectedCheckIn),
                properties.getEarlyCheckInGrace(), roomCharge);
        BigDecimal late = feeFor(Duration.between(expectedCheckOut, actualCheckOut),
                properties.getLateCheckOutGrace(), roomCharge);
        return new Fee(early, late, pricingService.money(early.add(late)));
    }

    private BigDecimal feeFor(Duration outsideWindow, Duration grace, BigDecimal base) {
        if (outsideWindow.isNegative() || outsideWindow.isZero() || outsideWindow.compareTo(grace) <= 0) {
            return BigDecimal.ZERO.setScale(2);
        }
        long chargeableMinutes = outsideWindow.minus(grace).toMinutes();
        long startedHours = Math.max(1, (chargeableMinutes + 59) / 60);
        BigDecimal rate = properties.getFeePerStartedHourPercent().multiply(BigDecimal.valueOf(startedHours));
        rate = rate.min(properties.getMaximumFeePercent());
        return pricingService.percentage(base, rate);
    }

    public record Fee(BigDecimal earlyCheckInFee, BigDecimal lateCheckOutFee, BigDecimal total) {}
}
