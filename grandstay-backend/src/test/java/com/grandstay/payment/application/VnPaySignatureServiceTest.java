package com.grandstay.payment.application;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VnPaySignatureServiceTest {
    private VnPaySignatureService signatures;

    @BeforeEach
    void setUp() {
        VnPayProperties properties = new VnPayProperties();
        properties.setHashSecret("TESTSECRET");
        signatures = new VnPaySignatureService(properties);
    }

    @Test
    void sortsAndUrlEncodesFieldsBeforeSigningWithHmacSha512() {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("vnp_TmnCode", "TESTCODE");
        fields.put("vnp_OrderInfo", "Thanh toan GrandStay");
        fields.put("vnp_Command", "pay");
        fields.put("vnp_Amount", "1000000");

        String expectedQuery = "vnp_Amount=1000000&vnp_Command=pay"
                + "&vnp_OrderInfo=Thanh+toan+GrandStay&vnp_TmnCode=TESTCODE";
        String expectedHash = "79d2eae01f6d670b74638fa8e18b90f10f9ee2a2cb73f37d3174a23be8e44ad"
                + "566a95442406aecf3a1154d210bd29e02b80b14e820406c18556063e4db7c78a4";

        assertThat(signatures.signedQuery(fields))
                .isEqualTo(expectedQuery + "&vnp_SecureHash=" + expectedHash);
    }

    @Test
    void verifiesAResponseWithoutIncludingTheSecureHashField() {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("vnp_TmnCode", "TESTCODE");
        fields.put("vnp_Amount", "1000000");
        fields.put("vnp_Command", "pay");
        String hash = signatures.sign(signatures.canonicalQuery(fields));
        fields.put("vnp_SecureHash", hash.toUpperCase(java.util.Locale.ROOT));

        assertThat(signatures.verifyQuery(fields)).isTrue();
        fields.put("vnp_Amount", "1000100");
        assertThat(signatures.verifyQuery(fields)).isFalse();
    }
}
