package com.grandstay.auth.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name = "refresh_tokens") @Getter @Setter @NoArgsConstructor
public class RefreshToken {
    @Id @GeneratedValue @UuidGenerator private UUID id;
    @Column(name="user_id", nullable=false) private UUID userId;
    @Column(name="token_hash", nullable=false, unique=true, length=64) private String tokenHash;
    @Column(name="family_id", nullable=false) private UUID familyId;
    @Column(name="parent_token_id") private UUID parentTokenId;
    @Column(name="expires_at", nullable=false) private Instant expiresAt;
    @Column(name="revoked_at") private Instant revokedAt;
    @Column(name="revoke_reason", length=100) private String revokeReason;
    @Column(name="replaced_by_token_id") private UUID replacedByTokenId;
    @Column(name="user_agent", length=500) private String userAgent;
    @JdbcTypeCode(SqlTypes.INET) @Column(name="ip_address", columnDefinition="inet") private String ipAddress;
    @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
}
