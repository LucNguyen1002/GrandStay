package com.grandstay.payment.application;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class VnPayGatewayClient {
    private final VnPayProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public VnPayGatewayClient(VnPayProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public VnPayQueryResponse query(VnPayQueryRequest request) {
        try {
            String body = objectMapper.writeValueAsString(request);
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(properties.getApiUrl()))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest,
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw gatewayFailure("VNPay returned HTTP " + response.statusCode());
            }
            return objectMapper.readValue(response.body(), VnPayQueryResponse.class);
        } catch (BusinessException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw gatewayFailure("VNPay query was interrupted");
        } catch (Exception exception) {
            throw gatewayFailure("Could not connect to VNPay Sandbox");
        }
    }

    private static BusinessException gatewayFailure(String message) {
        return new BusinessException(ErrorCode.VNPAY_PAYMENT_UNAVAILABLE, HttpStatus.BAD_GATEWAY, message);
    }

    public record VnPayQueryRequest(
            @JsonProperty("vnp_RequestId") String requestId,
            @JsonProperty("vnp_Version") String version,
            @JsonProperty("vnp_Command") String command,
            @JsonProperty("vnp_TmnCode") String tmnCode,
            @JsonProperty("vnp_TxnRef") String txnRef,
            @JsonProperty("vnp_OrderInfo") String orderInfo,
            @JsonProperty("vnp_TransactionNo") String transactionNo,
            @JsonProperty("vnp_TransactionDate") String transactionDate,
            @JsonProperty("vnp_CreateDate") String createDate,
            @JsonProperty("vnp_IpAddr") String ipAddress,
            @JsonProperty("vnp_SecureHash") String secureHash) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record VnPayQueryResponse(
            @JsonProperty("vnp_ResponseId") String responseId,
            @JsonProperty("vnp_Command") String command,
            @JsonProperty("vnp_ResponseCode") String responseCode,
            @JsonProperty("vnp_Message") String message,
            @JsonProperty("vnp_TmnCode") String tmnCode,
            @JsonProperty("vnp_TxnRef") String txnRef,
            @JsonProperty("vnp_Amount") String amount,
            @JsonProperty("vnp_OrderInfo") String orderInfo,
            @JsonProperty("vnp_BankCode") String bankCode,
            @JsonProperty("vnp_PayDate") String payDate,
            @JsonProperty("vnp_TransactionNo") String transactionNo,
            @JsonProperty("vnp_TransactionType") String transactionType,
            @JsonProperty("vnp_TransactionStatus") String transactionStatus,
            @JsonProperty("vnp_PromotionCode") String promotionCode,
            @JsonProperty("vnp_PromotionAmount") String promotionAmount,
            @JsonProperty("vnp_SecureHash") String secureHash) {}
}
