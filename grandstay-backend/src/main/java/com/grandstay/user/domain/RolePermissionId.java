package com.grandstay.user.domain;
import java.io.Serializable; import java.util.UUID; import jakarta.persistence.*; import lombok.*;
@Embeddable @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
public class RolePermissionId implements Serializable { @Column(name="role_id") private UUID roleId; @Column(name="permission_id") private UUID permissionId; }
