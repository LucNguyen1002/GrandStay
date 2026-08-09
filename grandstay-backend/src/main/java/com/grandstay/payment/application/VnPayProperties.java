package com.grandstay.payment.application;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "grandstay.payment.vnpay")
public class VnPayProperties {
    private boolean enabled;
    private String paymentUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    private String apiUrl = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
    private String tmnCode;
    private String hashSecret;
    private String returnUrl = "http://localhost:8080/api/v1/payments/vnpay/return";
    private String ipnUrl;
    private String frontendResultUrl = "http://localhost:3000/payment/vnpay/result";
    private String queryIpAddress = "127.0.0.1";
    private Duration expiration = Duration.ofMinutes(15);

    public boolean isConfigured() {
        return present(paymentUrl) && present(apiUrl) && present(tmnCode) && present(hashSecret)
                && present(returnUrl) && present(ipnUrl) && present(frontendResultUrl);
    }

    public void requireReady() {
        if (!enabled) throw new IllegalStateException("VNPay payment is disabled");
        if (!isConfigured()) throw new IllegalStateException("VNPay configuration is incomplete");
    }

    public boolean isSandbox() {
        return paymentUrl != null && paymentUrl.toLowerCase(java.util.Locale.ROOT).contains("sandbox");
    }

    private static boolean present(String value) { return value != null && !value.isBlank(); }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getPaymentUrl() { return paymentUrl; }
    public void setPaymentUrl(String paymentUrl) { this.paymentUrl = paymentUrl; }
    public String getApiUrl() { return apiUrl; }
    public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }
    public String getTmnCode() { return tmnCode; }
    public void setTmnCode(String tmnCode) { this.tmnCode = tmnCode; }
    public String getHashSecret() { return hashSecret; }
    public void setHashSecret(String hashSecret) { this.hashSecret = hashSecret; }
    public String getReturnUrl() { return returnUrl; }
    public void setReturnUrl(String returnUrl) { this.returnUrl = returnUrl; }
    public String getIpnUrl() { return ipnUrl; }
    public void setIpnUrl(String ipnUrl) { this.ipnUrl = ipnUrl; }
    public String getFrontendResultUrl() { return frontendResultUrl; }
    public void setFrontendResultUrl(String frontendResultUrl) { this.frontendResultUrl = frontendResultUrl; }
    public String getQueryIpAddress() { return queryIpAddress; }
    public void setQueryIpAddress(String queryIpAddress) { this.queryIpAddress = queryIpAddress; }
    public Duration getExpiration() { return expiration; }
    public void setExpiration(Duration expiration) { this.expiration = expiration; }
}
