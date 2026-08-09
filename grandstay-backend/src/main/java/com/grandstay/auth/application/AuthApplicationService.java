package com.grandstay.auth.application;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.grandstay.auth.application.AuthCommands.GoogleLogin;
import com.grandstay.auth.application.AuthCommands.Login;
import com.grandstay.auth.application.AuthCommands.Logout;
import com.grandstay.auth.application.AuthCommands.Refresh;
import com.grandstay.auth.application.AuthCommands.Register;
import com.grandstay.auth.application.AuthCommands.ChangePassword;
import com.grandstay.auth.application.GoogleIdentityVerifier.GoogleIdentity;
import com.grandstay.auth.domain.RefreshToken;
import com.grandstay.auth.infrastructure.RefreshTokenRepository;
import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import com.grandstay.user.domain.Role;
import com.grandstay.user.domain.User;
import com.grandstay.user.domain.UserRole;
import com.grandstay.user.domain.UserRoleId;
import com.grandstay.user.infrastructure.RolePermissionRepository;
import com.grandstay.user.infrastructure.RoleRepository;
import com.grandstay.user.infrastructure.UserRepository;
import com.grandstay.user.infrastructure.UserRoleRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthApplicationService {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final JwtProperties jwtProperties;
    private final AuthRateLimitProperties rateProperties;
    private final AuthRateLimiter rateLimiter;
    private final GoogleIdentityVerifier googleIdentityVerifier;
    private final Clock clock;
    private final String dummyPasswordHash;

    public AuthApplicationService(UserRepository userRepository,
                                  UserRoleRepository userRoleRepository,
                                  RoleRepository roleRepository,
                                  RolePermissionRepository rolePermissionRepository,
                                  RefreshTokenRepository refreshTokenRepository,
                                  PasswordEncoder passwordEncoder,
                                  JwtTokenService jwtTokenService,
                                  JwtProperties jwtProperties,
                                  AuthRateLimitProperties rateProperties,
                                  AuthRateLimiter rateLimiter,
                                  GoogleIdentityVerifier googleIdentityVerifier,
                                  Clock clock) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.roleRepository = roleRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.jwtProperties = jwtProperties;
        this.rateProperties = rateProperties;
        this.rateLimiter = rateLimiter;
        this.googleIdentityVerifier = googleIdentityVerifier;
        this.clock = clock;
        this.dummyPasswordHash = passwordEncoder.encode("grandstay-dummy-password-never-used");
    }

    @Transactional
    public TokenPair register(Register command) {
        validateRegistration(command);
        rateLimiter.checkLogin(command.ipAddress(), "register");
        String username = command.username().trim();
        String email = command.email().trim().toLowerCase(Locale.ROOT);
        ensureUsernameAndEmailAvailable(username, email);

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setFullName(command.fullName().trim());
        user.setPasswordHash(passwordEncoder.encode(command.password()));
        user.setStatus(UserStatus.ACTIVE);
        user = userRepository.saveAndFlush(user);
        assignCustomerRole(user.getId());
        return issuePair(user, UUID.randomUUID(), null, command.userAgent(), command.ipAddress());
    }

    @Transactional(noRollbackFor = AuthenticationFailureException.class)
    public TokenPair login(Login command) {
        validateLogin(command);
        String login = command.usernameOrEmail().trim();
        rateLimiter.checkLogin(command.ipAddress(), login);
        User user = userRepository.findForAuthentication(login).orElse(null);
        if (user == null) {
            passwordEncoder.matches(command.password(), dummyPasswordHash);
            throw new AuthenticationFailureException();
        }
        Instant now = clock.instant();
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw accountLocked();
        }
        if (user.getLockedUntil() != null && now.isBefore(user.getLockedUntil())) {
            throw accountLocked();
        }
        if (!passwordEncoder.matches(command.password(), user.getPasswordHash())) {
            int failures = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(failures);
            if (failures >= rateProperties.getAccountFailureLimit()) {
                user.setLockedUntil(now.plus(rateProperties.getAccountLockDuration()));
            }
            userRepository.saveAndFlush(user);
            throw new AuthenticationFailureException();
        }
        user.setFailedLoginAttempts(0); user.setLockedUntil(null); user.setLastLoginAt(now);
        userRepository.save(user);
        return issuePair(user, UUID.randomUUID(), null, command.userAgent(), command.ipAddress());
    }

    @Transactional
    public TokenPair loginWithGoogle(GoogleLogin command) {
        if (command == null || command.credential() == null || command.credential().isBlank()
                || command.credential().length() > 8192) {
            throw googleAuthenticationFailed();
        }
        rateLimiter.checkLogin(command.ipAddress(), "google");
        GoogleIdentity identity = googleIdentityVerifier.verify(command.credential());
        String email = identity.email().trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByGoogleSubjectAndDeletedAtIsNull(identity.subject()).orElse(null);
        if (user == null) {
            user = userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull(email).orElse(null);
            if (user != null && user.getGoogleSubject() != null
                    && !user.getGoogleSubject().equals(identity.subject())) {
                throw googleAuthenticationFailed();
            }
            if (user == null) {
                user = newGoogleUser(identity, email);
                user = userRepository.saveAndFlush(user);
                assignCustomerRole(user.getId());
            } else {
                user.setGoogleSubject(identity.subject());
            }
        }
        if (user.getStatus() != UserStatus.ACTIVE) throw accountLocked();
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(clock.instant());
        user = userRepository.save(user);
        return issuePair(user, UUID.randomUUID(), null, command.userAgent(), command.ipAddress());
    }

    @Transactional(noRollbackFor = RefreshTokenReuseException.class)
    public TokenPair refresh(Refresh command) {
        validateRefresh(command);
        rateLimiter.checkRefresh(command.ipAddress());
        String tokenHash = hash(command.refreshToken());
        RefreshToken oldToken = refreshTokenRepository.findByTokenHashForUpdate(tokenHash)
                .orElseThrow(this::invalidToken);
        Instant now = clock.instant();
        if (oldToken.getRevokedAt() != null) {
            refreshTokenRepository.revokeFamily(oldToken.getFamilyId(), now, "REUSE_DETECTED");
            throw new RefreshTokenReuseException();
        }
        if (!now.isBefore(oldToken.getExpiresAt())) throw invalidToken();
        User user = userRepository.findById(oldToken.getUserId())
                .orElseThrow(this::invalidToken);
        if (user.getDeletedAt() != null || user.getStatus() != UserStatus.ACTIVE) throw invalidToken();
        return issuePair(user, oldToken.getFamilyId(), oldToken, command.userAgent(), command.ipAddress());
    }

    @Transactional
    public void logout(Logout command) {
        if (command == null || command.refreshToken() == null || command.refreshToken().isBlank()) return;
        refreshTokenRepository.findByTokenHashForUpdate(hash(command.refreshToken())).ifPresent(token -> {
            Instant now = clock.instant();
            if (command.revokeFamily()) refreshTokenRepository.revokeFamily(token.getFamilyId(), now, "LOGOUT_ALL");
            else if (token.getRevokedAt() == null) {
                token.setRevokedAt(now); token.setRevokeReason("LOGOUT"); refreshTokenRepository.save(token);
            }
        });
    }

    @Transactional
    @PreAuthorize("hasAuthority('user:write')")
    public void revokeAllSessions(UUID userId) {
        if (!userRepository.existsById(userId)) throw BusinessException.notFound("User", userId);
        refreshTokenRepository.revokeAllForUser(userId, clock.instant(), "ADMIN_REVOKE");
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('user:read')")
    public List<SessionView> sessions(UUID userId) {
        if (!userRepository.existsById(userId)) throw BusinessException.notFound("User", userId);
        Instant now = clock.instant();
        return refreshTokenRepository.findAllByUserIdOrderByCreatedAtAsc(userId).stream()
                .collect(java.util.stream.Collectors.groupingBy(RefreshToken::getFamilyId))
                .entrySet().stream()
                .map(entry -> {
                    List<RefreshToken> family = entry.getValue().stream()
                            .sorted(java.util.Comparator.comparing(RefreshToken::getCreatedAt)).toList();
                    RefreshToken first = family.get(0);
                    RefreshToken latest = family.get(family.size() - 1);
                    boolean active = latest.getRevokedAt() == null && now.isBefore(latest.getExpiresAt());
                    return new SessionView(entry.getKey(), first.getCreatedAt(), latest.getCreatedAt(),
                            latest.getExpiresAt(), latest.getUserAgent(), latest.getIpAddress(), active,
                            latest.getRevokedAt(), latest.getRevokeReason());
                })
                .sorted(java.util.Comparator.comparing(SessionView::lastActivityAt).reversed())
                .limit(20)
                .toList();
    }

    @Transactional
    @PreAuthorize("hasAuthority('user:write')")
    public void revokeSession(UUID userId, UUID familyId) {
        if (!userRepository.existsById(userId)) throw BusinessException.notFound("User", userId);
        if (!refreshTokenRepository.existsByUserIdAndFamilyId(userId, familyId)) {
            throw BusinessException.notFound("Session", familyId);
        }
        refreshTokenRepository.revokeFamily(familyId, clock.instant(), "ADMIN_REVOKE");
    }

    public record SessionView(UUID familyId, Instant startedAt, Instant lastActivityAt,
                              Instant expiresAt, String userAgent, String ipAddress,
                              boolean active, Instant revokedAt, String revokeReason) {}

    @Transactional
    public void changePassword(ChangePassword command) {
        if (command == null || command.userId() == null || command.currentPassword() == null
                || command.newPassword() == null || command.newPassword().length() < 12
                || command.newPassword().length() > 72) {
            throw BusinessException.invalid("A new password between 12 and 72 characters is required");
        }
        User user = userRepository.findById(command.userId())
                .filter(candidate -> candidate.getDeletedAt() == null && candidate.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> BusinessException.notFound("User", command.userId()));
        if (!passwordEncoder.matches(command.currentPassword(), user.getPasswordHash())) {
            throw BusinessException.invalid("Current password is incorrect");
        }
        if (passwordEncoder.matches(command.newPassword(), user.getPasswordHash())) {
            throw BusinessException.invalid("New password must be different from the current password");
        }
        user.setPasswordHash(passwordEncoder.encode(command.newPassword()));
        user.setFailedLoginAttempts(0); user.setLockedUntil(null);
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId(), clock.instant(), "PASSWORD_CHANGED");
    }

    private TokenPair issuePair(User user, UUID familyId, RefreshToken parent,
                                String userAgent, String ipAddress) {
        List<String> roles = userRoleRepository.findRoleCodesByUserId(user.getId());
        List<String> permissions = rolePermissionRepository.findPermissionCodesByUserId(user.getId());
        JwtTokenService.AccessToken access = jwtTokenService.issue(user.getId(), user.getUsername(),
                user.getFullName(), roles, permissions);
        String rawRefresh = randomToken();
        Instant expiresAt = clock.instant().plus(jwtProperties.getRefreshTokenTtl());
        RefreshToken token = new RefreshToken();
        token.setUserId(user.getId()); token.setTokenHash(hash(rawRefresh)); token.setFamilyId(familyId);
        token.setParentTokenId(parent == null ? null : parent.getId()); token.setExpiresAt(expiresAt);
        token.setUserAgent(limit(userAgent, 500)); token.setIpAddress(validIp(ipAddress));
        token.setCreatedAt(clock.instant()); token = refreshTokenRepository.saveAndFlush(token);
        if (parent != null) {
            parent.setRevokedAt(clock.instant()); parent.setRevokeReason("ROTATED");
            parent.setReplacedByTokenId(token.getId()); refreshTokenRepository.save(parent);
        }
        return new TokenPair(access.value(), access.expiresAt(), rawRefresh, expiresAt);
    }

    private void validateLogin(Login command) {
        if (command == null || command.usernameOrEmail() == null || command.usernameOrEmail().isBlank()
                || command.password() == null || command.password().isBlank()
                || command.usernameOrEmail().length() > 254 || command.password().length() > 200) {
            throw new AuthenticationFailureException();
        }
    }

    private void validateRegistration(Register command) {
        if (command == null || command.fullName() == null || command.fullName().isBlank()
                || command.fullName().trim().length() > 150
                || command.username() == null
                || !command.username().trim().matches("[A-Za-z0-9._-]{3,80}")
                || command.email() == null || command.email().isBlank()
                || command.email().trim().length() > 254 || !command.email().contains("@")
                || command.password() == null || command.password().length() < 12
                || command.password().length() > 72
                || command.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw BusinessException.invalid("Registration information is invalid");
        }
    }

    private void ensureUsernameAndEmailAvailable(String username, String email) {
        if (userRepository.existsByUsernameIgnoreCaseAndDeletedAtIsNull(username)) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN, HttpStatus.CONFLICT,
                    "Username is already in use");
        }
        if (userRepository.existsByEmailIgnoreCaseAndDeletedAtIsNull(email)) {
            throw new BusinessException(ErrorCode.EMAIL_TAKEN, HttpStatus.CONFLICT,
                    "Email is already in use");
        }
    }

    private User newGoogleUser(GoogleIdentity identity, String email) {
        String localPart = email.substring(0, email.indexOf('@'))
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "");
        if (localPart.length() < 3) localPart = "guest";
        localPart = localPart.substring(0, Math.min(localPart.length(), 60));
        String subjectSuffix = identity.subject().replaceAll("[^A-Za-z0-9]", "");
        subjectSuffix = subjectSuffix.substring(0, Math.min(subjectSuffix.length(), 12));
        String username = localPart + "-" + subjectSuffix;
        if (userRepository.existsByUsernameIgnoreCaseAndDeletedAtIsNull(username)) {
            username = localPart + "-" + UUID.randomUUID().toString().substring(0, 8);
        }
        String fullName = identity.name() == null || identity.name().isBlank()
                ? localPart : identity.name().trim();

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setGoogleSubject(identity.subject());
        user.setFullName(fullName.substring(0, Math.min(fullName.length(), 150)));
        user.setPasswordHash(passwordEncoder.encode(randomToken().substring(0, 64)));
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private void assignCustomerRole(UUID userId) {
        Role role = roleRepository.findByCodeAndDeletedAtIsNull("CUSTOMER")
                .orElseThrow(() -> new IllegalStateException("CUSTOMER role is not configured"));
        UserRole assignment = new UserRole();
        assignment.setId(new UserRoleId(userId, role.getId()));
        assignment.setAssignedAt(clock.instant());
        userRoleRepository.saveAndFlush(assignment);
    }

    private void validateRefresh(Refresh command) {
        if (command == null || command.refreshToken() == null || command.refreshToken().isBlank()
                || command.refreshToken().length() > 1024) throw invalidToken();
    }

    private BusinessException invalidToken() {
        return new BusinessException(ErrorCode.TOKEN_INVALID, HttpStatus.UNAUTHORIZED,
                "Refresh token is invalid or expired");
    }

    private BusinessException accountLocked() {
        return new BusinessException(ErrorCode.ACCOUNT_LOCKED, HttpStatus.LOCKED,
                "Account is unavailable or temporarily locked");
    }

    private BusinessException googleAuthenticationFailed() {
        return new BusinessException(ErrorCode.GOOGLE_AUTH_FAILED, HttpStatus.UNAUTHORIZED,
                "Google credential is invalid or expired");
    }

    private String randomToken() {
        byte[] bytes = new byte[64]; SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String value) {
        try {
            return java.util.HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private String validIp(String ip) {
        if (ip == null || ip.length() > 45 || !ip.matches("[0-9a-fA-F:.]+")) return null;
        return ip;
    }

    private String limit(String value, int max) {
        return value == null ? null : value.substring(0, Math.min(value.length(), max));
    }
}
