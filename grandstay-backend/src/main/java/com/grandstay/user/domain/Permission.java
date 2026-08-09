package com.grandstay.user.domain;

import com.grandstay.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity @Table(name = "permissions") @Getter @Setter @NoArgsConstructor
public class Permission extends BaseEntity {
    @Column(nullable = false, unique = true, length = 100) private String code;
    @Column(nullable = false, length = 150) private String name;
    @Column(length = 500) private String description;
}
