package com.grandstay.auth.application;

import java.time.Instant;
import java.util.UUID;

import com.grandstay.auth.application.AuthCommands.Login;
import com.grandstay.auth.application.AuthCommands.Refresh;
import com.grandstay.auth.application.AuthCommands.Register;
import com.grandstay.auth.application.AuthCommands.ChangePassword;
import com.grandstay.auth.infrastructure.RefreshTokenRepository;
import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import com.grandstay.user.domain.Role;
import com.grandstay.user.domain.User;
import com.grandstay.user.domain.UserRole;
import com.grandstay.user.domain.UserRoleId;
import com.grandstay.user.infrastructure.RoleRepository;
import com.grandstay.user.infrastructure.UserRepository;
import com.grandstay.user.infrastructure.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class AuthApplicationServiceIntegrationTest {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired AuthApplicationService authService;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired UserRoleRepository userRoleRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JwtDecoder jwtDecoder;

    @Test
    void registersCustomerAndRejectsDuplicateIdentity() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String username = "guest-" + suffix;
        String email = username + "@grandstay.test";

        TokenPair tokens = authService.register(new Register("GrandStay Guest", username, email,
                "StrongPassword!123", "integration-test", "127.0.0.1"));

        var jwt = jwtDecoder.decode(tokens.accessToken());
        User user = userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull(email).orElseThrow();
        assertThat(jwt.getClaimAsStringList("roles")).containsExactly("CUSTOMER");
        assertThat(jwt.getClaimAsStringList("permissions"))
                .containsExactlyInAnyOrder("room:read", "promotion:read");
        assertThat(passwordEncoder.matches("StrongPassword!123", user.getPasswordHash())).isTrue();

        assertThatThrownBy(() -> authService.register(new Register("Another Guest", username,
                "other-" + email, "StrongPassword!123", "integration-test", "127.0.0.1")))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.USERNAME_TAKEN));
    }

    @Test
    void rotatesRefreshTokenAndRevokesFamilyOnReuse() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        User user = new User();
        user.setUsername("admin-" + suffix); user.setEmail("admin-" + suffix + "@grandstay.test");
        user.setFullName("Integration Admin"); user.setPasswordHash(passwordEncoder.encode("StrongPassword!123"));
        user.setStatus(UserStatus.ACTIVE); user = userRepository.save(user);
        Role admin = roleRepository.findByCodeAndDeletedAtIsNull("ADMIN").orElseThrow();
        UserRole assignment = new UserRole(); assignment.setId(new UserRoleId(user.getId(), admin.getId()));
        assignment.setAssignedAt(Instant.now()); userRoleRepository.save(assignment);

        TokenPair initial = authService.login(new Login(user.getUsername(), "StrongPassword!123",
                "integration-test", "127.0.0.1"));
        var jwt = jwtDecoder.decode(initial.accessToken());
        assertThat(jwt.getSubject()).isEqualTo(user.getId().toString());
        assertThat(jwt.getClaimAsString("username")).isEqualTo(user.getUsername());
        assertThat(jwt.getClaimAsStringList("roles")).contains("ADMIN");
        assertThat(jwt.getClaimAsStringList("permissions")).contains("room:read", "user:write");

        TokenPair rotated = authService.refresh(new Refresh(initial.refreshToken(),
                "integration-test", "127.0.0.1"));
        assertThat(rotated.refreshToken()).isNotEqualTo(initial.refreshToken());

        assertThatThrownBy(() -> authService.refresh(new Refresh(initial.refreshToken(),
                "integration-test", "127.0.0.1")))
                .isInstanceOf(RefreshTokenReuseException.class);

        assertThat(refreshTokenRepository.findAllByUserIdOrderByCreatedAtAsc(user.getId()))
                .hasSize(2).allMatch(token -> token.getRevokedAt() != null);
    }

    @Test
    void changesPasswordAndRevokesExistingSessions() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        User user = new User();
        user.setUsername("staff-" + suffix); user.setEmail("staff-" + suffix + "@grandstay.test");
        user.setFullName("Password Test"); user.setPasswordHash(passwordEncoder.encode("OriginalPass!123"));
        user.setStatus(UserStatus.ACTIVE); user = userRepository.save(user);
        UUID userId = user.getId();
        String username = user.getUsername();
        Role role = roleRepository.findByCodeAndDeletedAtIsNull("RECEPTIONIST").orElseThrow();
        UserRole assignment = new UserRole(); assignment.setId(new UserRoleId(user.getId(), role.getId()));
        assignment.setAssignedAt(Instant.now()); userRoleRepository.save(assignment);

        authService.login(new Login(username, "OriginalPass!123", "integration-test", "127.0.0.1"));
        authService.changePassword(new ChangePassword(userId, "OriginalPass!123", "ReplacementPass!456"));

        assertThat(refreshTokenRepository.findAllByUserIdOrderByCreatedAtAsc(userId))
                .allMatch(token -> token.getRevokedAt() != null);
        assertThat(passwordEncoder.matches("ReplacementPass!456",
                userRepository.findById(userId).orElseThrow().getPasswordHash())).isTrue();
        assertThatThrownBy(() -> authService.login(new Login(username, "OriginalPass!123",
                "integration-test", "127.0.0.1"))).isInstanceOf(AuthenticationFailureException.class);
        assertThat(authService.login(new Login(username, "ReplacementPass!456",
                "integration-test", "127.0.0.1")).accessToken()).isNotBlank();
    }
}
