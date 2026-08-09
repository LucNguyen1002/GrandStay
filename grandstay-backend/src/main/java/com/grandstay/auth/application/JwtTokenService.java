package com.grandstay.auth.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {
    private final JwtEncoder encoder;
    private final JwtProperties properties;
    private final Clock clock;

    public JwtTokenService(JwtEncoder encoder, JwtProperties properties, Clock clock) {
        this.encoder = encoder;
        this.properties = properties;
        this.clock = clock;
    }

    public AccessToken issue(UUID userId, String username, String fullName, Collection<String> roles,
                             Collection<String> permissions) {
        Instant issuedAt = clock.instant();
        Instant expiresAt = issuedAt.plus(properties.getAccessTokenTtl());
        List<String> authorities = java.util.stream.Stream.concat(
                        roles.stream().map(role -> "ROLE_" + role), permissions.stream())
                .distinct().sorted().toList();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(properties.getIssuer()).issuedAt(issuedAt).expiresAt(expiresAt)
                .subject(userId.toString()).id(UUID.randomUUID().toString())
                .claim("preferred_username", username)
                .claim("username", username)
                .claim("name", fullName)
                .claim("roles", List.copyOf(roles))
                .claim("permissions", List.copyOf(permissions))
                .claim("authorities", authorities)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        String token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new AccessToken(token, expiresAt);
    }

    public record AccessToken(String value, Instant expiresAt) {}
}
