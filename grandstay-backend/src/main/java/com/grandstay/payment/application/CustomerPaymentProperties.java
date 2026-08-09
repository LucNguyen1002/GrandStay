package com.grandstay.payment.application;

import java.math.BigDecimal;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "grandstay.payment.customer")
public class CustomerPaymentProperties {
    private BigDecimal depositPercent = BigDecimal.valueOf(30);

    public BigDecimal getDepositPercent() {
        if (depositPercent == null || depositPercent.signum() <= 0
                || depositPercent.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalStateException("Customer deposit percent must be greater than 0 and at most 100");
        }
        return depositPercent;
    }

    public void setDepositPercent(BigDecimal depositPercent) {
        this.depositPercent = depositPercent;
    }
}
