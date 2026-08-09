package com.grandstay.payment.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.payment.application.PaymentApplicationService.PaymentView;
import com.grandstay.payment.application.PaymentApplicationService.ProviderPayment;
import com.grandstay.payment.application.PaymentCommands.RecordPayment;
import com.grandstay.payment.application.VnPayGatewayClient.VnPayQueryRequest;
import com.grandstay.payment.application.VnPayGatewayClient.VnPayQueryResponse;
import com.grandstay.shared.domain.ModelEnums.PaymentMethod;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;
import com.grandstay.shared.domain.ModelEnums.PaymentStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class VnPayPaymentApplicationService {
    private static final String PROVIDER = "VNPAY";
    private static final String VERSION = "2.1.0";
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final VnPayProperties properties;
    private final VnPaySignatureService signatures;
    private final VnPayGatewayClient gateway;
    private final PaymentApplicationService payments;
    private final Clock clock;

    public VnPayPaymentApplicationService(VnPayProperties properties,
                                          VnPaySignatureService signatures,
                                          VnPayGatewayClient gateway,
                                          PaymentApplicationService payments,
                                          Clock clock) {
        this.properties = properties;
        this.signatures = signatures;
        this.gateway = gateway;
        this.payments = payments;
        this.clock = clock;
    }

    public VnPayCheckout create(UUID bookingId, PaymentPurpose purpose, BigDecimal amount,
                                String clientIpAddress) {
        return create(bookingId, purpose, amount, null, clientIpAddress);
    }

    public VnPayCheckout createCustomerDeposit(UUID bookingId, BigDecimal amount,
                                               BigDecimal maximumDeposit,
                                               String clientIpAddress) {
        return create(bookingId, PaymentPurpose.DEPOSIT, amount, maximumDeposit, clientIpAddress);
    }

    private VnPayCheckout create(UUID bookingId, PaymentPurpose purpose, BigDecimal amount,
                                 BigDecimal maximumDeposit, String clientIpAddress) {
        requireCreateReady();
        if (bookingId == null || purpose == null) {
            throw BusinessException.invalid("Booking and payment purpose are required");
        }
        long vnpAmount = scaledAmount(amount);
        Instant now = clock.instant();
        String createDate = format(now);
        String txnRef = transactionReference(now);
        String orderInfo = "Thanh toan GrandStay " + txnRef;

        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("vnp_Version", VERSION);
        fields.put("vnp_Command", "pay");
        fields.put("vnp_TmnCode", properties.getTmnCode());
        fields.put("vnp_Amount", Long.toString(vnpAmount));
        fields.put("vnp_CreateDate", createDate);
        fields.put("vnp_CurrCode", "VND");
        fields.put("vnp_IpAddr", safeIp(clientIpAddress));
        fields.put("vnp_Locale", "vn");
        fields.put("vnp_OrderInfo", orderInfo);
        fields.put("vnp_OrderType", "other");
        fields.put("vnp_ReturnUrl", properties.getReturnUrl());
        fields.put("vnp_TxnRef", txnRef);
        fields.put("vnp_ExpireDate", format(now.plus(properties.getExpiration())));
        String payUrl = properties.getPaymentUrl() + "?" + signatures.signedQuery(fields);

        RecordPayment command = new RecordPayment(bookingId, "VNPAY-" + txnRef, purpose,
                PaymentMethod.VNPAY, amount.setScale(2), "VND", false, null,
                maximumDeposit == null ? "VNPay online payment" : "Customer VNPay deposit");
        var payment = maximumDeposit == null
                ? payments.recordProvider(command, PROVIDER, txnRef, createDate)
                : payments.recordCustomerProvider(command, PROVIDER, txnRef, createDate, maximumDeposit);
        return new VnPayCheckout(payment.id(), bookingId, txnRef, payUrl, payment.status(),
                payment.amount(), payment.currency());
    }

    public VnPayIpnResponse handleIpn(Map<String, String> parameters) {
        if (!properties.isConfigured()) return new VnPayIpnResponse("99", "Merchant is not configured");
        if (!validCallback(parameters)) return new VnPayIpnResponse("97", "Invalid signature");
        String txnRef = parameters.get("vnp_TxnRef");
        Optional<ProviderPayment> existing = txnRef == null ? Optional.empty()
                : payments.findProvider(PROVIDER, txnRef);
        if (existing.isEmpty()) return new VnPayIpnResponse("01", "Order not found");
        ProviderPayment payment = existing.get();
        BigDecimal amount;
        try {
            amount = returnedAmount(parameters.get("vnp_Amount"));
        } catch (RuntimeException exception) {
            return new VnPayIpnResponse("04", "Invalid amount");
        }
        if (amount.compareTo(payment.amount()) != 0) {
            return new VnPayIpnResponse("04", "Invalid amount");
        }
        if (payment.status() != PaymentStatus.PENDING) {
            return new VnPayIpnResponse("02", "Order already confirmed");
        }
        try {
            if (successful(parameters.get("vnp_ResponseCode"),
                    parameters.get("vnp_TransactionStatus"))) {
                payments.settleProvider(PROVIDER, txnRef, payment.providerRequestId(), amount,
                        parameters.get("vnp_TransactionNo"));
            } else {
                payments.failProvider(PROVIDER, txnRef, payment.providerRequestId(), amount,
                        failure(parameters.get("vnp_ResponseCode"),
                                parameters.get("vnp_TransactionStatus")));
            }
            return new VnPayIpnResponse("00", "Confirm Success");
        } catch (BusinessException exception) {
            return new VnPayIpnResponse("99", "Unable to update order");
        }
    }

    public VnPayReturnResult inspectReturn(Map<String, String> parameters) {
        if (!properties.isConfigured() || !validCallback(parameters)) {
            return new VnPayReturnResult(false, "INVALID", null, null);
        }
        String txnRef = parameters.get("vnp_TxnRef");
        Optional<ProviderPayment> existing = txnRef == null ? Optional.empty()
                : payments.findProvider(PROVIDER, txnRef);
        if (existing.isEmpty()) return new VnPayReturnResult(false, "INVALID", null, null);
        ProviderPayment payment = existing.get();
        try {
            if (returnedAmount(parameters.get("vnp_Amount")).compareTo(payment.amount()) != 0) {
                return new VnPayReturnResult(false, "INVALID", null, null);
            }
        } catch (RuntimeException exception) {
            return new VnPayReturnResult(false, "INVALID", null, null);
        }
        String result = successful(parameters.get("vnp_ResponseCode"),
                parameters.get("vnp_TransactionStatus")) ? "PROCESSING" : "FAILED";
        return new VnPayReturnResult(true, result, payment.paymentId(), payment.bookingId());
    }

    public ProviderPayment reconcile(UUID paymentId) {
        requireConfigured();
        PaymentView payment = payments.get(paymentId);
        if (!PROVIDER.equals(payment.provider()) || payment.providerOrderId() == null) {
            throw BusinessException.invalid("The selected payment is not a VNPay transaction");
        }
        ProviderPayment current = payments.findProvider(PROVIDER, payment.providerOrderId())
                .orElseThrow(() -> BusinessException.notFound("VNPay payment", payment.providerOrderId()));
        if (current.status() != PaymentStatus.PENDING) return current;

        String requestId = queryRequestId(clock.instant());
        String createDate = format(clock.instant());
        String orderInfo = "Kiem tra giao dich " + payment.providerOrderId();
        String raw = String.join("|", requestId, VERSION, "querydr", properties.getTmnCode(),
                payment.providerOrderId(), payment.providerRequestId(), createDate,
                properties.getQueryIpAddress(), orderInfo);
        VnPayQueryRequest request = new VnPayQueryRequest(requestId, VERSION, "querydr",
                properties.getTmnCode(), payment.providerOrderId(), orderInfo, "",
                payment.providerRequestId(), createDate, properties.getQueryIpAddress(),
                signatures.sign(raw));
        VnPayQueryResponse response = gateway.query(request);
        validateQueryResponse(payment, response);
        if (!"00".equals(response.responseCode())) {
            throw gatewayFailure("VNPay query failed with code " + safe(response.responseCode()));
        }
        if ("00".equals(response.transactionStatus())) {
            return payments.settleProvider(PROVIDER, payment.providerOrderId(),
                    payment.providerRequestId(), payment.amount(), response.transactionNo());
        }
        if (isPending(response.transactionStatus())) {
            if (payment.createdAt() != null
                    && !clock.instant().isBefore(payment.createdAt().plus(properties.getExpiration()))) {
                return payments.failProvider(PROVIDER, payment.providerOrderId(),
                        payment.providerRequestId(), payment.amount(), "VNPay checkout expired");
            }
            return current;
        }
        return payments.failProvider(PROVIDER, payment.providerOrderId(),
                payment.providerRequestId(), payment.amount(),
                failure(response.responseCode(), response.transactionStatus()));
    }

    public VnPayAvailability availability() {
        boolean configured = properties.isConfigured();
        return new VnPayAvailability(properties.isEnabled() && configured, configured,
                properties.isSandbox());
    }

    private void validateQueryResponse(PaymentView payment, VnPayQueryResponse response) {
        String raw = String.join("|", safe(response.responseId()), safe(response.command()),
                safe(response.responseCode()), safe(response.message()), safe(response.tmnCode()),
                safe(response.txnRef()), safe(response.amount()), safe(response.bankCode()),
                safe(response.payDate()), safe(response.transactionNo()), safe(response.transactionType()),
                safe(response.transactionStatus()), safe(response.orderInfo()), safe(response.promotionCode()),
                safe(response.promotionAmount()));
        if (response.secureHash() == null || !constantHash(signatures.sign(raw), response.secureHash())) {
            throw new BusinessException(ErrorCode.VNPAY_SIGNATURE_INVALID,
                    HttpStatus.UNPROCESSABLE_ENTITY, "VNPay query signature is invalid");
        }
        if (!properties.getTmnCode().equals(response.tmnCode())
                || !payment.providerOrderId().equals(response.txnRef())) {
            throw new BusinessException(ErrorCode.VNPAY_SIGNATURE_INVALID,
                    HttpStatus.UNPROCESSABLE_ENTITY, "VNPay query response does not match the payment");
        }
        if ("00".equals(response.responseCode())
                && returnedAmount(response.amount()).compareTo(payment.amount()) != 0) {
            throw new BusinessException(ErrorCode.VNPAY_SIGNATURE_INVALID,
                    HttpStatus.UNPROCESSABLE_ENTITY, "VNPay query amount does not match the payment");
        }
    }

    private boolean validCallback(Map<String, String> parameters) {
        return parameters != null && properties.getTmnCode().equals(parameters.get("vnp_TmnCode"))
                && signatures.verifyQuery(parameters);
    }

    private void requireCreateReady() {
        try {
            properties.requireReady();
        } catch (IllegalStateException exception) {
            throw new BusinessException(ErrorCode.VNPAY_PAYMENT_UNAVAILABLE,
                    HttpStatus.SERVICE_UNAVAILABLE, exception.getMessage());
        }
    }

    private void requireConfigured() {
        if (!properties.isConfigured()) {
            throw new BusinessException(ErrorCode.VNPAY_PAYMENT_UNAVAILABLE,
                    HttpStatus.SERVICE_UNAVAILABLE, "VNPay configuration is incomplete");
        }
    }

    private static boolean successful(String responseCode, String transactionStatus) {
        return "00".equals(responseCode) && "00".equals(transactionStatus);
    }

    private static boolean isPending(String transactionStatus) {
        return transactionStatus == null || transactionStatus.isBlank()
                || java.util.Set.of("01", "05", "06").contains(transactionStatus);
    }

    private static BigDecimal returnedAmount(String amount) {
        if (amount == null || !amount.matches("\\d{1,12}")) throw new IllegalArgumentException("Invalid amount");
        return new BigDecimal(amount).movePointLeft(2).setScale(2, RoundingMode.UNNECESSARY);
    }

    private static long scaledAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0 || amount.stripTrailingZeros().scale() > 0) {
            throw BusinessException.invalid("VNPay only accepts a positive whole VND amount");
        }
        if (amount.compareTo(BigDecimal.valueOf(5_000)) < 0) {
            throw BusinessException.invalid("VNPay requires a minimum payment of 5,000 VND");
        }
        try {
            long scaled = amount.movePointRight(2).longValueExact();
            if (Long.toString(scaled).length() > 12) throw new ArithmeticException("Amount is too large");
            return scaled;
        } catch (ArithmeticException exception) {
            throw BusinessException.invalid("VNPay payment amount is outside the supported range");
        }
    }

    private String format(Instant instant) {
        return DATE_TIME.format(instant.atZone(BUSINESS_ZONE));
    }

    private static String transactionReference(Instant now) {
        String timestamp = DATE_TIME.format(now.atZone(BUSINESS_ZONE));
        String random = UUID.randomUUID().toString().replace("-", "")
                .substring(0, 10).toUpperCase(java.util.Locale.ROOT);
        return "GS" + timestamp + random;
    }

    private String queryRequestId(Instant now) {
        return DATE_TIME.format(now.atZone(BUSINESS_ZONE))
                + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static String safeIp(String ip) {
        if (ip == null || ip.isBlank()) return "127.0.0.1";
        String candidate = ip.split(",", 2)[0].trim();
        return candidate.length() <= 45 ? candidate : "127.0.0.1";
    }

    private static String failure(String responseCode, String transactionStatus) {
        return "VNPay response code " + safe(responseCode)
                + ", transaction status " + safe(transactionStatus);
    }

    private static boolean constantHash(String expected, String supplied) {
        return java.security.MessageDigest.isEqual(
                expected.toLowerCase(java.util.Locale.ROOT).getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                supplied.toLowerCase(java.util.Locale.ROOT).getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }

    private static String safe(String value) { return value == null ? "" : value; }

    private static BusinessException gatewayFailure(String message) {
        return new BusinessException(ErrorCode.VNPAY_PAYMENT_UNAVAILABLE, HttpStatus.BAD_GATEWAY, message);
    }

    public record VnPayCheckout(UUID paymentId, UUID bookingId, String txnRef, String payUrl,
                                PaymentStatus status, BigDecimal amount, String currency) {}
    public record VnPayAvailability(boolean enabled, boolean configured, boolean sandbox) {}
    public record VnPayIpnResponse(String rspCode, String message) {}
    public record VnPayReturnResult(boolean valid, String result, UUID paymentId, UUID bookingId) {}
}
