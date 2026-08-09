package com.grandstay.audit.api;

import java.time.Instant;
import java.util.UUID;

import com.grandstay.audit.application.AuditApplicationService;
import com.grandstay.audit.application.AuditApplicationService.AuditLogView;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audit-logs")
@Tag(name = "Audit logs")
@PreAuthorize("hasAuthority('audit:read')")
public class AuditController {
    private final AuditApplicationService service;

    public AuditController(AuditApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public Page<AuditLogView> list(@RequestParam(required = false) String action,
                                   @RequestParam(required = false) String entityType,
                                   @RequestParam(required = false) UUID actorUserId,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
                                   @ParameterObject @PageableDefault(size = 30, sort = "occurredAt") Pageable pageable) {
        return service.list(action, entityType, actorUserId, from, to, pageable);
    }
}
