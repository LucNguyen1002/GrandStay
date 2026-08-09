package com.grandstay.user.domain;

import com.grandstay.shared.domain.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity @Table(name = "roles") @Getter @Setter @NoArgsConstructor
public class Role extends SoftDeletableEntity {
    @Column(nullable = false, unique = true, length = 50) private String code;
    @Column(nullable = false, length = 100) private String name;
    @Column(length = 500) private String description;
    @Column(name = "system_role", nullable = false) private boolean systemRole;
}
