package com.grandstay.customer.application;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import com.grandstay.shared.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CustomerDataCrypto {
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private final SecretKeySpec encryptionKey;
    private final SecretKeySpec searchKey;
    private final SecureRandom random = new SecureRandom();

    public CustomerDataCrypto(@Value("${grandstay.security.pii.key}") String keyMaterial) {
        if (keyMaterial == null || keyMaterial.length() < 32) {
            throw new IllegalStateException("PII encryption key must contain at least 32 characters");
        }
        this.encryptionKey = new SecretKeySpec(derive(keyMaterial, "grandstay-pii-encryption"), "AES");
        this.searchKey = new SecretKeySpec(derive(keyMaterial, "grandstay-pii-search"), "HmacSHA256");
    }

    public String encryptText(String value) { return encrypt(value.getBytes(StandardCharsets.UTF_8)); }
    public String encrypt(byte[] value) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(value);
            byte[] payload = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
            return "v1:" + Base64.getEncoder().encodeToString(payload);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Could not encrypt customer data", exception);
        }
    }

    public byte[] decrypt(String payload) {
        try {
            if (payload == null || !payload.startsWith("v1:")) throw BusinessException.invalid("Encrypted customer data is invalid");
            byte[] decoded = Base64.getDecoder().decode(payload.substring(3));
            if (decoded.length <= IV_BYTES) throw BusinessException.invalid("Encrypted customer data is invalid");
            byte[] iv = java.util.Arrays.copyOfRange(decoded, 0, IV_BYTES);
            byte[] encrypted = java.util.Arrays.copyOfRange(decoded, IV_BYTES, decoded.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey, new GCMParameterSpec(TAG_BITS, iv));
            return cipher.doFinal(encrypted);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw BusinessException.invalid("Encrypted customer data could not be read");
        }
    }

    public String blindIndex(String normalizedValue) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(searchKey);
            return HexFormat.of().formatHex(mac.doFinal(normalizedValue.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Could not index customer data", exception);
        }
    }

    public String contentHash(byte[] content) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content)); }
        catch (GeneralSecurityException exception) { throw new IllegalStateException(exception); }
    }

    private static byte[] derive(String material, String purpose) {
        try { return MessageDigest.getInstance("SHA-256").digest((purpose + ':' + material).getBytes(StandardCharsets.UTF_8)); }
        catch (GeneralSecurityException exception) { throw new IllegalStateException(exception); }
    }
}
