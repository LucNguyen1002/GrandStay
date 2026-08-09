package com.grandstay.user.domain;

import java.time.Instant;

import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.shared.domain.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity @Table(name = "users") @Getter @Setter @NoArgsConstructor
public class User extends SoftDeletableEntity {
    @Column(nullable = false, length = 80) private String username;
    @Column(nullable = false, length = 254) private String email;
    @Column(name = "google_subject", length = 255) private String googleSubject;
    @Column(name = "password_hash", nullable = false, length = 100) private String passwordHash;
    @Column(name = "full_name", nullable = false, length = 150) private String fullName;
    @Column(length = 30) private String phone;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private UserStatus status;
    @Column(name = "last_login_at") private Instant lastLoginAt;
    @Column(name = "failed_login_attempts", nullable = false) private int failedLoginAttempts;
    @Column(name = "locked_until") private Instant lockedUntil;
}
