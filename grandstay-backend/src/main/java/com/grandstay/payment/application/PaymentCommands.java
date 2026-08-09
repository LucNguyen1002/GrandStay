package com.grandstay.payment.application;

import java.math.BigDecimal;
import java.util.UUID;

import com.grandstay.shared.domain.ModelEnums.PaymentMethod;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;

public final class PaymentCommands {
    private PaymentCommands() {}

    public record RecordPayment(UUID bookingId, String transactionCode, PaymentPurpose purpose,
                                PaymentMethod method, BigDecimal amount, String currency,
                                boolean completed, String providerReference, String notes) {}
    public record RefundPayment(UUID originalPaymentId, String transactionCode,
                                BigDecimal amount, String reason) {}
}
