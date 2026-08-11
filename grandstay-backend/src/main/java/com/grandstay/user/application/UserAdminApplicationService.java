package com.grandstay.user.application;

import java.time.Clock;
import java.util.Locale;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.grandstay.auth.application.PasswordPolicy;
import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.shared.dto.EntityDtos.UserDto;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import com.grandstay.user.domain.Role;
import com.grandstay.user.domain.User;
import com.grandstay.user.domain.UserRole;
import com.grandstay.user.domain.UserRoleId;
import com.grandstay.user.infrastructure.RoleRepository;
import com.grandstay.user.infrastructure.UserRepository;
import com.grandstay.user.infrastructure.UserRoleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAdminApplicationService {
    private final UserRepository users;
    private final RoleRepository roles;
    private final UserRoleRepository assignments;
    private final PasswordEncoder encoder;
    private final EntityMapper mapper;
    private final Clock clock;

    public UserAdminApplicationService(UserRepository users, RoleRepository roles,
                                       UserRoleRepository assignments, PasswordEncoder encoder,
                                       EntityMapper mapper, Clock clock) {
        this.users = users;
        this.roles = roles;
        this.assignments = assignments;
        this.encoder = encoder;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<UserDto> list(UserStatus status, Pageable pageable) {
        return (status == null ? users.findAllByDeletedAtIsNull(pageable)
                : users.findAllByStatusAndDeletedAtIsNull(status, pageable)).map(mapper::toDto);
    }

    @Transactional(readOnly = true)
    public List<String> roles(UUID userId) {
        requireUser(userId);
        return assignments.findRoleCodesByUserId(userId);
    }

    @Transactional
    public UserDto create(CreateUser command) {
        requireStrongPassword(command.password(), command.username(), command.email());
        User user = new User();
        user.setUsername(command.username().trim());
        user.setEmail(command.email().trim());
        user.setFullName(command.fullName().trim());
        user.setPhone(command.phone());
        user.setPasswordHash(encoder.encode(command.password()));
        user.setStatus(command.status());
        user = users.save(user);
        assign(user.getId(), command.roles());
        return mapper.toDto(user);
    }

    @Transactional
    public UserDto update(UUID id, UpdateUser command) {
        User user = requireUser(id);
        user.setEmail(command.email().trim());
        user.setFullName(command.fullName().trim());
        user.setPhone(command.phone());
        user.setStatus(command.status());
        if (command.password() != null && !command.password().isBlank()) {
            requireStrongPassword(command.password(), user.getUsername(), command.email());
            user.setPasswordHash(encoder.encode(command.password()));
        }
        assign(id, command.roles());
        return mapper.toDto(users.save(user));
    }

    private void requireStrongPassword(String password, String username, String email) {
        if (!PasswordPolicy.isStrong(password, username, email)) {
            throw BusinessException.invalid("Password must contain uppercase, lowercase, number and special character and must not contain account identifiers");
        }
    }

    @Transactional
    public void lock(UUID id, UUID actingUserId) {
        if (id.equals(actingUserId)) {
            throw BusinessException.invalid("Administrators cannot lock their own account");
        }
        User user = requireUser(id);
        user.setStatus(UserStatus.LOCKED);
        user.setLockedUntil(null);
        users.save(user);
    }

    @Transactional
    public void unlock(UUID id) {
        User user = requireUser(id);
        if (user.getStatus() != UserStatus.LOCKED) {
            throw BusinessException.invalid("Only a locked account can be unlocked");
        }
        user.setStatus(UserStatus.ACTIVE);
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        users.save(user);
    }

    @Transactional
    public void delete(UUID id) {
        User user = requireUser(id);
        user.setDeletedAt(clock.instant());
        user.setStatus(UserStatus.INACTIVE);
        users.save(user);
    }

    private User requireUser(UUID id) {
        return users.findById(id)
                .filter(user -> user.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("User", id));
    }

    private void assign(UUID userId, Set<String> codes) {
        assignments.deleteAll(assignments.findAllByIdUserId(userId));
        for (String code : codes) {
            Role role = roles.findByCodeAndDeletedAtIsNull(code.toUpperCase(Locale.ROOT))
                    .orElseThrow(() -> BusinessException.notFound("Role", code));
            UserRole assignment = new UserRole();
            assignment.setId(new UserRoleId(userId, role.getId()));
            assignment.setAssignedAt(clock.instant());
            assignments.save(assignment);
        }
    }

    public record CreateUser(String username, String email, String fullName, String phone,
                             String password, UserStatus status, Set<String> roles) {
        public CreateUser {
            roles = roles == null ? Set.of() : Set.copyOf(roles);
        }
    }

    public record UpdateUser(String email, String fullName, String phone, String password,
                             UserStatus status, Set<String> roles) {
        public UpdateUser {
            roles = roles == null ? Set.of() : Set.copyOf(roles);
        }
    }
}
