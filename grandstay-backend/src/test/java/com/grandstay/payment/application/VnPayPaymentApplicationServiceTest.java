package com.grandstay.payment.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.payment.application.PaymentApplicationService.BalanceResult;
import com.grandstay.payment.application.PaymentApplicationService.PaymentResult;
import com.grandstay.payment.application.PaymentApplicationService.ProviderPayment;
import com.grandstay.payment.application.PaymentCommands.RecordPayment;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;
import com.grandstay.shared.domain.ModelEnums.PaymentStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VnPayPaymentApplicationServiceTest {
    @Mock VnPaySignatureService signatures;
    @Mock VnPayGatewayClient gateway;
    @Mock PaymentApplicationService payments;

    private VnPayPaymentApplicationService service;
    private VnPayProperties properties;

    @BeforeEach
    void setUp() {
        properties = new VnPayProperties();
        properties.setEnabled(true);
        properties.setTmnCode("TESTCODE");
        properties.setHashSecret("TESTSECRET");
        properties.setReturnUrl("https://hotel.test/api/v1/payments/vnpay/return");
        properties.setIpnUrl("https://hotel.test/api/v1/payments/vnpay/ipn");
        properties.setFrontendResultUrl("https://hotel.test/payment/vnpay/result");
        service = new VnPayPaymentApplicationService(properties, signatures, gateway, payments,
                Clock.fixed(Instant.parse("2026-08-09T05:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void createsSignedPendingPaymentBeforeReturningCheckout() {
        UUID bookingId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        when(signatures.signedQuery(any())).thenReturn("vnp_Amount=19500000&vnp_SecureHash=abc");
        when(payments.recordProvider(any(), eq("VNPAY"), any(), eq("20260809120000")))
                .thenReturn(new PaymentResult(paymentId, "VNPAY-1", PaymentType.PAYMENT,
                        PaymentStatus.PENDING, new BigDecimal("195000.00"), "VND",
                        new BalanceResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO)));

        var checkout = service.create(bookingId, PaymentPurpose.DEPOSIT,
                new BigDecimal("195000"), "127.0.0.1");

        assertThat(checkout.paymentId()).isEqualTo(paymentId);
        assertThat(checkout.payUrl()).startsWith(properties.getPaymentUrl() + "?");
        ArgumentCaptor<RecordPayment> command = ArgumentCaptor.forClass(RecordPayment.class);
        verify(payments).recordProvider(command.capture(), eq("VNPAY"), any(),
                eq("20260809120000"));
        assertThat(command.getValue().method().name()).isEqualTo("VNPAY");
        assertThat(command.getValue().completed()).isFalse();
    }

    @Test
    void validSuccessfulIpnSettlesTheMatchingPendingPayment() {
        UUID paymentId = UUID.randomUUID();
        UUID bookingId = UUID.randomUUID();
        ProviderPayment pending = new ProviderPayment(paymentId, bookingId, "GS1",
                "20260809120000", new BigDecimal("195000.00"), "VND",
                PaymentStatus.PENDING, null);
        Map<String, String> parameters = new HashMap<>();
        parameters.put("vnp_TmnCode", "TESTCODE");
        parameters.put("vnp_TxnRef", "GS1");
        parameters.put("vnp_Amount", "19500000");
        parameters.put("vnp_ResponseCode", "00");
        parameters.put("vnp_TransactionStatus", "00");
        parameters.put("vnp_TransactionNo", "14985233");
        when(signatures.verifyQuery(parameters)).thenReturn(true);
        when(payments.findProvider("VNPAY", "GS1")).thenReturn(Optional.of(pending));

        var response = service.handleIpn(parameters);

        assertThat(response.rspCode()).isEqualTo("00");
        verify(payments).settleProvider("VNPAY", "GS1", "20260809120000",
                new BigDecimal("195000.00"), "14985233");
    }

    @Test
    void invalidIpnSignatureIsRejectedWithoutLookingUpThePayment() {
        Map<String, String> parameters = Map.of("vnp_TmnCode", "TESTCODE",
                "vnp_SecureHash", "tampered");
        when(signatures.verifyQuery(parameters)).thenReturn(false);

        assertThat(service.handleIpn(parameters).rspCode()).isEqualTo("97");
    }
}
