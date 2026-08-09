package com.grandstay.auth.infrastructure;

import java.util.List;
import java.util.UUID;

import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.user.infrastructure.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActiveUserFilterTest {
    private static final UUID USER_ID = UUID.fromString("5c724eec-27c3-46cc-a777-da8ca290cd0d");

    @Mock UserRepository users;
    @Mock SecurityProblemWriter problemWriter;
    @Mock HttpServletRequest request;
    @Mock HttpServletResponse response;
    @Mock FilterChain chain;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void continuesForActiveAccount() throws Exception {
        authenticate();
        when(users.existsByIdAndStatusAndDeletedAtIsNull(USER_ID, UserStatus.ACTIVE)).thenReturn(true);

        new ActiveUserFilter(users, problemWriter).doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(problemWriter, never()).unauthorized(request, response);
    }

    @Test
    void rejectsTokenAsSoonAsAccountIsLocked() throws Exception {
        authenticate();
        when(users.existsByIdAndStatusAndDeletedAtIsNull(USER_ID, UserStatus.ACTIVE)).thenReturn(false);

        new ActiveUserFilter(users, problemWriter).doFilter(request, response, chain);

        verify(problemWriter).unauthorized(request, response);
        verify(chain, never()).doFilter(request, response);
    }

    private static void authenticate() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject(USER_ID.toString())
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }
}
