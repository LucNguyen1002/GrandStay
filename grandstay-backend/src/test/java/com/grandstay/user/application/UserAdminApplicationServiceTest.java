package com.grandstay.user.application;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import com.grandstay.user.domain.User;
import com.grandstay.user.infrastructure.RoleRepository;
import com.grandstay.user.infrastructure.UserRepository;
import com.grandstay.user.infrastructure.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserAdminApplicationServiceTest {
    private static final UUID ADMIN_ID = UUID.fromString("83d40b7d-0f45-4eaa-a0ab-b1feaf3b1c82");
    private static final UUID USER_ID = UUID.fromString("2373094e-7d82-4202-875e-3dc26ea9aa79");

    @Mock UserRepository users;
    @Mock RoleRepository roles;
    @Mock UserRoleRepository assignments;
    @Mock PasswordEncoder encoder;
    @Mock EntityMapper mapper;
    UserAdminApplicationService service;

    @BeforeEach
    void setUp() {
        service = new UserAdminApplicationService(users, roles, assignments, encoder, mapper,
                Clock.fixed(Instant.parse("2026-08-07T10:30:00Z"), ZoneOffset.UTC));
    }

    @Test
    void locksAnotherAccount() {
        User user = user(USER_ID, UserStatus.ACTIVE);
        user.setLockedUntil(Instant.parse("2026-08-07T11:00:00Z"));
        when(users.findById(USER_ID)).thenReturn(Optional.of(user));

        service.lock(USER_ID, ADMIN_ID);

        assertThat(user.getStatus()).isEqualTo(UserStatus.LOCKED);
        assertThat(user.getLockedUntil()).isNull();
        verify(users).save(user);
    }

    @Test
    void preventsAdministratorFromLockingOwnAccount() {
        assertThatThrownBy(() -> service.lock(ADMIN_ID, ADMIN_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getMessage())
                                .isEqualTo("Administrators cannot lock their own account"));
        verifyNoInteractions(users);
    }

    @Test
    void unlocksAccountAndClearsFailureState() {
        User user = user(USER_ID, UserStatus.LOCKED);
        user.setFailedLoginAttempts(5);
        user.setLockedUntil(Instant.parse("2026-08-08T10:30:00Z"));
        when(users.findById(USER_ID)).thenReturn(Optional.of(user));

        service.unlock(USER_ID);

        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getFailedLoginAttempts()).isZero();
        assertThat(user.getLockedUntil()).isNull();
        verify(users).save(user);
    }

    private static User user(UUID id, UserStatus status) {
        User user = new User();
        user.setId(id);
        user.setStatus(status);
        return user;
    }
}
