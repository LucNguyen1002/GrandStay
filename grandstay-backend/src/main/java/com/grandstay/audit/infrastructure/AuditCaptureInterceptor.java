package com.grandstay.audit.infrastructure;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.grandstay.audit.application.AuditApplicationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuditCaptureInterceptor implements HandlerInterceptor {
    private static final Logger LOGGER = LoggerFactory.getLogger(AuditCaptureInterceptor.class);
    private final AuditApplicationService audit;

    public AuditCaptureInterceptor(AuditApplicationService audit) {
        this.audit = audit;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception exception) {
        if (!isMutation(request) || exception != null || response.getStatus() >= 400) return;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) return;
        try {
            Target target = target(request);
            audit.record(UUID.fromString(jwt.getSubject()), target.action(), target.entityType(),
                    target.entityId(), requestId(request), request.getRemoteAddr(),
                    Map.of("method", request.getMethod(), "path", request.getRequestURI(),
                            "status", response.getStatus()));
        } catch (RuntimeException auditFailure) {
            LOGGER.error("Unable to persist audit event for {} {}", request.getMethod(),
                    request.getRequestURI(), auditFailure);
        }
    }

    private static boolean isMutation(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/api/v1/")
                && switch (request.getMethod()) {
                    case "POST", "PUT", "PATCH", "DELETE" -> true;
                    default -> false;
                };
    }

    private static Target target(HttpServletRequest request) {
        String relative = request.getRequestURI().substring("/api/v1/".length());
        String[] segments = relative.split("/");
        String entityType = segments.length == 0 ? "SYSTEM" : singular(segments[0]);
        String entityId = segments.length > 1 ? segments[1] : "COLLECTION";
        String action;
        if ("POST".equals(request.getMethod())) {
            action = segments.length <= 1 ? "CREATE" : segments[segments.length - 1].replace('-', '_').toUpperCase(Locale.ROOT);
        } else if ("DELETE".equals(request.getMethod())) action = "DELETE";
        else action = "UPDATE";
        return new Target(action, entityType, entityId);
    }

    private static String singular(String segment) {
        return switch (segment) {
            case "room-types" -> "ROOM_TYPE";
            case "rate-plans" -> "RATE_PLAN";
            case "audit-logs" -> "AUDIT_LOG";
            default -> {
                String value = segment.endsWith("ies")
                        ? segment.substring(0, segment.length() - 3) + "y"
                        : segment.endsWith("s") ? segment.substring(0, segment.length() - 1) : segment;
                yield value.replace('-', '_').toUpperCase(Locale.ROOT);
            }
        };
    }

    private static String requestId(HttpServletRequest request) {
        String supplied = request.getHeader("X-Request-Id");
        return supplied == null || supplied.isBlank() ? UUID.randomUUID().toString() : supplied;
    }

    private record Target(String action, String entityType, String entityId) {}
}
