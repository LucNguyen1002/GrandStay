package com.grandstay.user.domain;
import java.time.Instant; import java.util.UUID; import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="role_permissions") @Getter @Setter @NoArgsConstructor
public class RolePermission { @EmbeddedId private RolePermissionId id; @Column(name="granted_at",nullable=false) private Instant grantedAt; @Column(name="granted_by") private UUID grantedBy; }
