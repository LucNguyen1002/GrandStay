package com.grandstay.shared.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@MappedSuperclass
public abstract class SoftDeletableEntity extends BaseEntity {
    @Column(name = "deleted_at")
    private Instant deletedAt;
}
