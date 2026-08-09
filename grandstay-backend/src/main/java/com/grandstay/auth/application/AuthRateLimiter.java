package com.grandstay.auth.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class AuthRateLimiter {
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AuthRateLimitProperties properties;
    private final Clock clock;

    public AuthRateLimiter(AuthRateLimitProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    public void checkLogin(String ip, String username) {
        check("login:" + safe(ip) + ':' + safe(username).toLowerCase(),
                properties.getLoginAttempts(), properties.getLoginWindow());
    }

    public void checkRefresh(String ip) {
        check("refresh:" + safe(ip), properties.getRefreshAttempts(), properties.getRefreshWindow());
    }

    private void check(String key, int limit, Duration duration) {
        Instant now = clock.instant();
        Window updated = windows.compute(key, (ignored, current) -> {
            if (current == null || !now.isBefore(current.expiresAt())) {
                return new Window(1, now.plus(duration));
            }
            return new Window(current.count() + 1, current.expiresAt());
        });
        if (updated.count() > limit) {
            throw new BusinessException(ErrorCode.RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS,
                    "Too many authentication attempts; retry later");
        }
        if (windows.size() > 10_000) windows.entrySet().removeIf(entry -> !now.isBefore(entry.getValue().expiresAt()));
    }

    private String safe(String value) { return value == null || value.isBlank() ? "unknown" : value; }
    private record Window(int count, Instant expiresAt) {}
}
