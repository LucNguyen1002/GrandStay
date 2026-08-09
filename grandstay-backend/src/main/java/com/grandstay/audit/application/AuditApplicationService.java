package com.grandstay.audit.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grandstay.audit.domain.AuditLog;
import com.grandstay.audit.infrastructure.AuditLogRepository;
import com.grandstay.user.domain.User;
import com.grandstay.user.infrastructure.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditApplicationService {
    private final AuditLogRepository logs;
    private final UserRepository users;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public AuditApplicationService(AuditLogRepository logs, UserRepository users,
                                   ObjectMapper objectMapper, Clock clock) {
        this.logs = logs;
        this.users = users;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UUID actorUserId, String action, String entityType, String entityId,
                       String requestId, String ipAddress, Map<String, Object> changes) {
        AuditLog log = new AuditLog();
        log.setActorUserId(actorUserId);
        log.setAction(limit(action, 100));
        log.setEntityType(limit(entityType, 100));
        log.setEntityId(limit(entityId, 100));
        log.setRequestId(limit(requestId, 100));
        log.setIpAddress(ipAddress);
        log.setChanges(json(changes));
        log.setOccurredAt(clock.instant());
        logs.save(log);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogView> list(String action, String entityType, UUID actorUserId,
                                   Instant from, Instant to, Pageable pageable) {
        String normalizedAction = normalize(action);
        String normalizedEntityType = normalize(entityType);
        Specification<AuditLog> filters = (root, query, builder) -> builder.conjunction();
        if (normalizedAction != null) {
            filters = filters.and((root, query, builder) ->
                    builder.equal(root.get("action"), normalizedAction));
        }
        if (normalizedEntityType != null) {
            filters = filters.and((root, query, builder) ->
                    builder.equal(root.get("entityType"), normalizedEntityType));
        }
        if (actorUserId != null) {
            filters = filters.and((root, query, builder) ->
                    builder.equal(root.get("actorUserId"), actorUserId));
        }
        if (from != null) {
            filters = filters.and((root, query, builder) ->
                    builder.greaterThanOrEqualTo(root.get("occurredAt"), from));
        }
        if (to != null) {
            filters = filters.and((root, query, builder) ->
                    builder.lessThan(root.get("occurredAt"), to));
        }
        Page<AuditLog> page = logs.findAll(filters, pageable);
        Map<UUID, User> actors = users.findAllById(page.getContent().stream()
                        .map(AuditLog::getActorUserId).filter(java.util.Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return page.map(log -> {
            User actor = actors.get(log.getActorUserId());
            return new AuditLogView(log.getId(), log.getActorUserId(), actor == null ? null : actor.getFullName(),
                    log.getAction(), log.getEntityType(), log.getEntityId(), log.getRequestId(),
                    log.getIpAddress(), log.getChanges(), log.getOccurredAt());
        });
    }

    private String json(Map<String, Object> changes) {
        try {
            return objectMapper.writeValueAsString(changes == null ? Map.of() : changes);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String limit(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    public record AuditLogView(Long id, UUID actorUserId, String actorName, String action,
                               String entityType, String entityId, String requestId,
                               String ipAddress, String changes, Instant occurredAt) {}
}
