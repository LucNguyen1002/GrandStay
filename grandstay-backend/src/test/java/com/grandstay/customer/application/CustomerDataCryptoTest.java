package com.grandstay.customer.application;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class CustomerDataCryptoTest {
    private final CustomerDataCrypto crypto = new CustomerDataCrypto("test-only-pii-encryption-key-with-more-than-32-characters");

    @Test
    void encryptsWithRandomIvAndDecryptsTheOriginalData() {
        byte[] original = "079203001234".getBytes(StandardCharsets.UTF_8);
        String first = crypto.encrypt(original);
        String second = crypto.encrypt(original);

        assertNotEquals(first, second);
        assertArrayEquals(original, crypto.decrypt(first));
        assertArrayEquals(original, crypto.decrypt(second));
    }

    @Test
    void producesStableBlindIndexesWithoutExposingThePlaintext() {
        String value = "NATIONAL_ID:079203001234";
        String first = crypto.blindIndex(value);
        assertEquals(first, crypto.blindIndex(value));
        assertNotEquals(value, first);
    }
}
