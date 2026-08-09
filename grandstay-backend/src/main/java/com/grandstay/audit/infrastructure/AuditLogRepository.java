package com.grandstay.audit.infrastructure;

import com.grandstay.audit.domain.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {
    Page<AuditLog> findAllByEntityTypeAndEntityIdOrderByOccurredAtDesc(String type, String id, Pageable pageable);
}
