package com.grandstay.user.domain;
import java.io.Serializable; import java.util.UUID; import jakarta.persistence.*; import lombok.*;
@Embeddable @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
public class UserRoleId implements Serializable { @Column(name="user_id") private UUID userId; @Column(name="role_id") private UUID roleId; }
