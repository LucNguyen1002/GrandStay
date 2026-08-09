package com.grandstay.realtime.infrastructure;

import java.io.IOException;
import java.util.Set;

import com.grandstay.realtime.application.RealtimeUpdateHub;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RealtimeMutationFilter extends OncePerRequestFilter {
    private static final String API_PREFIX = "/api/v1/";
    private static final Set<String> MUTATION_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final Set<String> PROVIDER_CALLBACKS = Set.of(
            "/api/v1/payments/vnpay/ipn", "/api/v1/payments/vnpay/return");

    private final RealtimeUpdateHub hub;

    public RealtimeMutationFilter(RealtimeUpdateHub hub) {
        this.hub = hub;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (!path.startsWith(API_PREFIX) || path.startsWith(API_PREFIX + "auth/")
                || path.startsWith(API_PREFIX + "realtime/")) {
            return true;
        }
        return !MUTATION_METHODS.contains(request.getMethod()) && !PROVIDER_CALLBACKS.contains(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        filterChain.doFilter(request, response);
        if (response.getStatus() >= 200 && response.getStatus() < 400) {
            hub.publish(resourceName(request.getRequestURI()));
        }
    }

    private String resourceName(String path) {
        String remainder = path.substring(API_PREFIX.length());
        int separator = remainder.indexOf('/');
        return separator < 0 ? remainder : remainder.substring(0, separator);
    }
}
