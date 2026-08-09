package com.grandstay.auth.application;

import java.time.Clock;
import java.util.Locale;
import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.user.domain.User;
import com.grandstay.user.domain.UserRole;
import com.grandstay.user.domain.UserRoleId;
import com.grandstay.user.infrastructure.RoleRepository;
import com.grandstay.user.infrastructure.UserRepository;
import com.grandstay.user.infrastructure.UserRoleRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(prefix = "grandstay.security.bootstrap-admin", name = "enabled", havingValue = "true")
public class AdminBootstrapInitializer implements ApplicationRunner {
    private final AdminBootstrapProperties properties;
    private final UserRepository users;
    private final RoleRepository roles;
    private final UserRoleRepository userRoles;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public AdminBootstrapInitializer(AdminBootstrapProperties properties, UserRepository users,
            RoleRepository roles, UserRoleRepository userRoles, PasswordEncoder passwordEncoder, Clock clock) {
        this.properties = properties; this.users = users; this.roles = roles;
        this.userRoles = userRoles; this.passwordEncoder = passwordEncoder; this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        validateConfiguration();
        if (users.findByUsernameIgnoreCaseAndDeletedAtIsNull(properties.getUsername()).isPresent()) return;
        if (users.findByEmailIgnoreCaseAndDeletedAtIsNull(properties.getEmail()).isPresent()) {
            throw new IllegalStateException("Bootstrap administrator email is already used by another account");
        }
        var adminRole = roles.findByCodeAndDeletedAtIsNull("ADMIN")
                .orElseThrow(() -> new IllegalStateException("ADMIN role seed is missing"));
        User user = new User();
        user.setUsername(properties.getUsername().trim().toLowerCase(Locale.ROOT));
        user.setEmail(properties.getEmail().trim().toLowerCase(Locale.ROOT));
        user.setFullName(properties.getFullName().trim());
        user.setPasswordHash(passwordEncoder.encode(properties.getPassword()));
        user.setStatus(UserStatus.ACTIVE);
        user = users.save(user);
        UserRole assignment = new UserRole();
        assignment.setId(new UserRoleId(user.getId(), adminRole.getId()));
        assignment.setAssignedAt(clock.instant());
        userRoles.save(assignment);
    }

    private void validateConfiguration() {
        if (properties.getUsername() == null || properties.getUsername().isBlank()
                || properties.getEmail() == null || !properties.getEmail().contains("@")
                || properties.getFullName() == null || properties.getFullName().isBlank()
                || properties.getPassword() == null || properties.getPassword().length() < 12) {
            throw new IllegalStateException("ADMIN_BOOTSTRAP_* values are required and password must contain at least 12 characters");
        }
    }
}
