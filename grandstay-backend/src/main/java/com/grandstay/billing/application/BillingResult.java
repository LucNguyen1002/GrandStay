package com.grandstay.billing.application;

import java.math.BigDecimal;
import java.util.UUID;

import com.grandstay.shared.domain.ModelEnums.InvoiceStatus;

public record BillingResult(UUID invoiceId, String invoiceNumber, InvoiceStatus status,
                            BigDecimal roomCharge, BigDecimal serviceCharge,
                            BigDecimal extraFee, BigDecimal discountAmount,
                            BigDecimal taxAmount, BigDecimal grandTotal, String currency) {}
