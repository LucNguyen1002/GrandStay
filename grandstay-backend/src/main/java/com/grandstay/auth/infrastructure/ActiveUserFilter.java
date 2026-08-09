package com.grandstay.auth.infrastructure;

import java.io.IOException;
import java.util.UUID;

import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.user.infrastructure.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ActiveUserFilter extends OncePerRequestFilter {
    private final UserRepository users;
    private final SecurityProblemWriter problemWriter;

    public ActiveUserFilter(UserRepository users, SecurityProblemWriter problemWriter) {
        this.users = users;
        this.problemWriter = problemWriter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof Jwt jwt
                && !isActive(jwt.getSubject())) {
            SecurityContextHolder.clearContext();
            problemWriter.unauthorized(request, response);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isActive(String subject) {
        try {
            return users.existsByIdAndStatusAndDeletedAtIsNull(UUID.fromString(subject), UserStatus.ACTIVE);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
