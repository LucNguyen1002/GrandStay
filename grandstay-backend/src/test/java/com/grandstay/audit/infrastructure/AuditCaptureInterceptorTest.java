package com.grandstay.audit.infrastructure;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.grandstay.audit.application.AuditApplicationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditCaptureInterceptorTest {
    @Mock AuditApplicationService audit;
    @Mock HttpServletRequest request;
    @Mock HttpServletResponse response;
    @Mock Authentication authentication;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void recordsSuccessfulAuthenticatedMutationWithoutRequestBody() {
        UUID actorId = UUID.randomUUID();
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "none")
                .subject(actorId.toString()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(authentication.getPrincipal()).thenReturn(jwt);
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/api/v1/bookings");
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("X-Request-Id")).thenReturn("request-1");
        when(response.getStatus()).thenReturn(201);

        new AuditCaptureInterceptor(audit).afterCompletion(request, response, new Object(), null);

        verify(audit).record(eq(actorId), eq("CREATE"), eq("BOOKING"), eq("COLLECTION"),
                eq("request-1"), eq("127.0.0.1"), eq(Map.of(
                        "method", "POST", "path", "/api/v1/bookings", "status", 201)));
    }

    @Test
    void ignoresFailedMutation() {
        when(request.getMethod()).thenReturn("DELETE");
        when(request.getRequestURI()).thenReturn("/api/v1/users/user-1");
        when(response.getStatus()).thenReturn(409);

        new AuditCaptureInterceptor(audit).afterCompletion(request, response, new Object(), null);

        verify(audit, never()).record(any(), any(), any(), any(), any(), any(), any());
    }
}
