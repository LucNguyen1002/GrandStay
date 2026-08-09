package com.grandstay.payment.application;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.TreeMap;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Service;

@Service
public class VnPaySignatureService {
    private final VnPayProperties properties;

    public VnPaySignatureService(VnPayProperties properties) { this.properties = properties; }

    public String signedQuery(Map<String, String> fields) {
        String query = canonicalQuery(fields);
        return query + "&vnp_SecureHash=" + sign(query);
    }

    public boolean verifyQuery(Map<String, String> fields) {
        String supplied = fields.get("vnp_SecureHash");
        if (supplied == null || supplied.isBlank()) return false;
        return constantTimeEquals(sign(canonicalQuery(fields)), supplied);
    }

    public String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(properties.getHashSecret().getBytes(StandardCharsets.UTF_8),
                    "HmacSHA512"));
            return java.util.HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Could not create VNPay signature", exception);
        }
    }

    String canonicalQuery(Map<String, String> fields) {
        TreeMap<String, String> sorted = new TreeMap<>();
        fields.forEach((key, value) -> {
            if (key != null && key.startsWith("vnp_")
                    && !key.equals("vnp_SecureHash") && !key.equals("vnp_SecureHashType")
                    && value != null && !value.isBlank()) {
                sorted.put(key, value);
            }
        });
        return sorted.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(java.util.stream.Collectors.joining("&"));
    }

    private boolean constantTimeEquals(String expected, String supplied) {
        return MessageDigest.isEqual(expected.toLowerCase(java.util.Locale.ROOT)
                        .getBytes(StandardCharsets.US_ASCII),
                supplied.toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
