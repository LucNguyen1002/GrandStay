package com.grandstay.auth.application;

import java.time.Instant;

public record TokenPair(String tokenType, String accessToken, Instant accessTokenExpiresAt,
                        String refreshToken, Instant refreshTokenExpiresAt) {
    public TokenPair(String accessToken, Instant accessTokenExpiresAt,
                     String refreshToken, Instant refreshTokenExpiresAt) {
        this("Bearer", accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt);
    }
}
