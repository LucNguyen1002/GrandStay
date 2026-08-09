package com.grandstay.auth.application;

import java.util.List;

import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

@Service
public class GoogleIdentityVerifier {
    private static final List<String> TRUSTED_ISSUERS = List.of(
            "https://accounts.google.com", "accounts.google.com");

    private final GoogleAuthProperties properties;
    private volatile JwtDecoder decoder;

    public GoogleIdentityVerifier(GoogleAuthProperties properties) {
        this.properties = properties;
    }

    public GoogleIdentity verify(String credential) {
        if (!properties.isConfigured()) {
            throw new BusinessException(ErrorCode.GOOGLE_AUTH_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE,
                    "Google sign-in is not configured");
        }
        try {
            Jwt jwt = decoder().decode(credential);
            if (!TRUSTED_ISSUERS.contains(jwt.getIssuer() == null ? null : jwt.getIssuer().toString())
                    || !jwt.getAudience().contains(properties.getClientId())
                    || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) {
                throw invalidCredential();
            }
            String subject = jwt.getSubject();
            String email = jwt.getClaimAsString("email");
            String name = jwt.getClaimAsString("name");
            if (subject == null || subject.isBlank() || subject.length() > 255
                    || email == null || email.isBlank() || email.length() > 254) {
                throw invalidCredential();
            }
            return new GoogleIdentity(subject, email, name);
        } catch (JwtException exception) {
            throw invalidCredential();
        }
    }

    private JwtDecoder decoder() {
        JwtDecoder current = decoder;
        if (current == null) {
            synchronized (this) {
                current = decoder;
                if (current == null) {
                    current = NimbusJwtDecoder.withJwkSetUri(properties.getJwkSetUri()).build();
                    decoder = current;
                }
            }
        }
        return current;
    }

    private BusinessException invalidCredential() {
        return new BusinessException(ErrorCode.GOOGLE_AUTH_FAILED, HttpStatus.UNAUTHORIZED,
                "Google credential is invalid or expired");
    }

    public record GoogleIdentity(String subject, String email, String name) {}
}
