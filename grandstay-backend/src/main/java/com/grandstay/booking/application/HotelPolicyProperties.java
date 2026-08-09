package com.grandstay.booking.application;

import java.math.BigDecimal;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "grandstay.policy")
public class HotelPolicyProperties {
    private Duration earlyCheckInGrace = Duration.ofMinutes(60);
    private Duration lateCheckOutGrace = Duration.ofMinutes(30);
    private BigDecimal feePerStartedHourPercent = BigDecimal.TEN;
    private BigDecimal maximumFeePercent = BigDecimal.valueOf(50);

    public Duration getEarlyCheckInGrace() { return earlyCheckInGrace; }
    public void setEarlyCheckInGrace(Duration value) { this.earlyCheckInGrace = value; }
    public Duration getLateCheckOutGrace() { return lateCheckOutGrace; }
    public void setLateCheckOutGrace(Duration value) { this.lateCheckOutGrace = value; }
    public BigDecimal getFeePerStartedHourPercent() { return feePerStartedHourPercent; }
    public void setFeePerStartedHourPercent(BigDecimal value) { this.feePerStartedHourPercent = value; }
    public BigDecimal getMaximumFeePercent() { return maximumFeePercent; }
    public void setMaximumFeePercent(BigDecimal value) { this.maximumFeePercent = value; }
}
