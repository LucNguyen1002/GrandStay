package com.grandstay.audit.domain;
import java.time.Instant; import java.util.UUID; import jakarta.persistence.*; import lombok.*; import org.hibernate.annotations.JdbcTypeCode; import org.hibernate.type.SqlTypes;
@Entity @Table(name="audit_logs") @Getter @Setter @NoArgsConstructor
public class AuditLog {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id; @Column(name="actor_user_id") private UUID actorUserId;
 @Column(nullable=false,length=100) private String action; @Column(name="entity_type",nullable=false,length=100) private String entityType;
 @Column(name="entity_id",nullable=false,length=100) private String entityId; @Column(name="request_id",length=100) private String requestId;
 @JdbcTypeCode(SqlTypes.INET) @Column(name="ip_address",columnDefinition="inet") private String ipAddress; @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb") private String changes;
 @Column(name="occurred_at",nullable=false,updatable=false) private Instant occurredAt;
}
