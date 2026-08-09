package com.grandstay.user.domain;
import java.time.Instant; import java.util.UUID; import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="user_roles") @Getter @Setter @NoArgsConstructor
public class UserRole { @EmbeddedId private UserRoleId id; @Column(name="assigned_at",nullable=false) private Instant assignedAt; @Column(name="assigned_by") private UUID assignedBy; }
