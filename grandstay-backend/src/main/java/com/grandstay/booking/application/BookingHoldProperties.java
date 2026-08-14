package com.grandstay.booking.application;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "grandstay.booking")
public class BookingHoldProperties {
    private boolean holdEnabled = true;
    private Duration holdDuration = Duration.ofMinutes(15);

    public boolean isHoldEnabled() { return holdEnabled; }
    public void setHoldEnabled(boolean holdEnabled) { this.holdEnabled = holdEnabled; }
    public Duration getHoldDuration() {
        if (holdDuration == null || holdDuration.isNegative() || holdDuration.isZero()) {
            throw new IllegalStateException("Booking hold duration must be positive");
        }
        return holdDuration;
    }
    public void setHoldDuration(Duration holdDuration) { this.holdDuration = holdDuration; }
}
