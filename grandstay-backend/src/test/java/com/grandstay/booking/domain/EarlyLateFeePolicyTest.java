package com.grandstay.booking.domain;

import java.math.BigDecimal;
import java.time.Instant;

import com.grandstay.booking.application.HotelPolicyProperties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EarlyLateFeePolicyTest {
    private final EarlyLateFeePolicy policy = new EarlyLateFeePolicy(
            new HotelPolicyProperties(), new PricingService());

    @Test
    void appliesGraceAndCapsEarlyLateFees() {
        Instant expectedIn = Instant.parse("2030-01-01T07:00:00Z");
        Instant expectedOut = Instant.parse("2030-01-02T05:00:00Z");
        var fee = policy.calculate(expectedIn, expectedIn.minusSeconds(3 * 3600),
                expectedOut, expectedOut.plusSeconds(10 * 3600), new BigDecimal("1000000"));
        assertThat(fee.earlyCheckInFee()).isEqualByComparingTo("200000.00");
        assertThat(fee.lateCheckOutFee()).isEqualByComparingTo("500000.00");
        assertThat(fee.total()).isEqualByComparingTo("700000.00");
    }

    @Test
    void doesNotChargeInsideGraceWindow() {
        Instant expectedIn = Instant.parse("2030-01-01T07:00:00Z");
        Instant expectedOut = Instant.parse("2030-01-02T05:00:00Z");
        var fee = policy.calculate(expectedIn, expectedIn.minusSeconds(3600),
                expectedOut, expectedOut.plusSeconds(1800), BigDecimal.TEN);
        assertThat(fee.total()).isEqualByComparingTo("0.00");
    }
}
