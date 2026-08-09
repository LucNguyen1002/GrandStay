package com.grandstay.auth.application;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.grandstay.auth.domain.RefreshToken;
import com.grandstay.auth.infrastructure.RefreshTokenRepository;
import com.grandstay.user.infrastructure.RolePermissionRepository;
import com.grandstay.user.infrastructure.RoleRepository;
import com.grandstay.user.infrastructure.UserRepository;
import com.grandstay.user.infrastructure.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthSessionApplicationServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-09T04:00:00Z");
    @Mock UserRepository users;
    @Mock UserRoleRepository userRoles;
    @Mock RoleRepository roles;
    @Mock RolePermissionRepository permissions;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock PasswordEncoder encoder;
    @Mock JwtTokenService jwtTokens;
    @Mock JwtProperties jwtProperties;
    @Mock AuthRateLimitProperties rateProperties;
    @Mock AuthRateLimiter rateLimiter;
    @Mock GoogleIdentityVerifier googleVerifier;
    AuthApplicationService service;

    @BeforeEach
    void setUp() {
        when(encoder.encode(anyString())).thenReturn("dummy-hash");
        service = new AuthApplicationService(users, userRoles, roles, permissions, refreshTokens,
                encoder, jwtTokens, jwtProperties, rateProperties, rateLimiter, googleVerifier,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void groupsRotatedTokensIntoOneSafeSessionView() {
        UUID userId = UUID.randomUUID();
        UUID familyId = UUID.randomUUID();
        RefreshToken first = token(userId, familyId, NOW.minusSeconds(7200), NOW.plusSeconds(86400));
        first.setRevokedAt(NOW.minusSeconds(3600));
        first.setRevokeReason("ROTATED");
        RefreshToken latest = token(userId, familyId, NOW.minusSeconds(3600), NOW.plusSeconds(172800));
        latest.setUserAgent("Edge on Windows");
        latest.setIpAddress("127.0.0.1");
        when(users.existsById(userId)).thenReturn(true);
        when(refreshTokens.findAllByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(first, latest));

        var result = service.sessions(userId);

        assertThat(result).singleElement().satisfies(session -> {
            assertThat(session.familyId()).isEqualTo(familyId);
            assertThat(session.startedAt()).isEqualTo(first.getCreatedAt());
            assertThat(session.lastActivityAt()).isEqualTo(latest.getCreatedAt());
            assertThat(session.active()).isTrue();
            assertThat(session.userAgent()).isEqualTo("Edge on Windows");
        });
    }

    @Test
    void revokesOnlyTheRequestedUsersTokenFamily() {
        UUID userId = UUID.randomUUID();
        UUID familyId = UUID.randomUUID();
        when(users.existsById(userId)).thenReturn(true);
        when(refreshTokens.existsByUserIdAndFamilyId(userId, familyId)).thenReturn(true);

        service.revokeSession(userId, familyId);

        verify(refreshTokens).revokeFamily(familyId, NOW, "ADMIN_REVOKE");
    }

    private static RefreshToken token(UUID userId, UUID familyId, Instant createdAt, Instant expiresAt) {
        RefreshToken token = new RefreshToken();
        token.setId(UUID.randomUUID());
        token.setUserId(userId);
        token.setFamilyId(familyId);
        token.setCreatedAt(createdAt);
        token.setExpiresAt(expiresAt);
        return token;
    }
}
