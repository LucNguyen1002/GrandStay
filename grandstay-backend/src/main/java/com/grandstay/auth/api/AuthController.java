package com.grandstay.auth.api;

import java.util.UUID;

import com.grandstay.auth.application.AuthApplicationService;
import com.grandstay.auth.application.AuthCommands.GoogleLogin;
import com.grandstay.auth.application.AuthCommands.Login;
import com.grandstay.auth.application.AuthCommands.Logout;
import com.grandstay.auth.application.AuthCommands.Refresh;
import com.grandstay.auth.application.AuthCommands.Register;
import com.grandstay.auth.application.AuthCommands.ChangePassword;
import com.grandstay.auth.application.TokenPair;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication")
public class AuthController {
    private final AuthApplicationService authService;

    public AuthController(AuthApplicationService authService) { this.authService = authService; }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register a customer account and issue an access/refresh token pair")
    public TokenPair register(@Valid @RequestBody RegisterRequest request, HttpServletRequest servletRequest) {
        return authService.register(new Register(request.fullName(), request.username(), request.email(),
                request.password(), servletRequest.getHeader("User-Agent"), servletRequest.getRemoteAddr()));
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate and issue an access/refresh token pair")
    public TokenPair login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        return authService.login(new Login(request.usernameOrEmail(), request.password(),
                servletRequest.getHeader("User-Agent"), servletRequest.getRemoteAddr()));
    }

    @PostMapping("/google")
    @Operation(summary = "Authenticate with a Google ID token and issue a GrandStay token pair")
    public TokenPair google(@Valid @RequestBody GoogleLoginRequest request,
                            HttpServletRequest servletRequest) {
        return authService.loginWithGoogle(new GoogleLogin(request.credential(),
                servletRequest.getHeader("User-Agent"), servletRequest.getRemoteAddr()));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate a refresh token and issue a new token pair")
    public TokenPair refresh(@Valid @RequestBody RefreshRequest request, HttpServletRequest servletRequest) {
        return authService.refresh(new Refresh(request.refreshToken(), servletRequest.getHeader("User-Agent"),
                servletRequest.getRemoteAddr()));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Revoke one refresh token or its complete token family")
    public void logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(new Logout(request.refreshToken(), request.allDevices()));
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Change the current user's password and revoke all refresh sessions")
    public void changePassword(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(new ChangePassword(UUID.fromString(jwt.getSubject()),
                request.currentPassword(), request.newPassword()));
    }

    public record RegisterRequest(@NotBlank @Size(max = 150) String fullName,
                                  @NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{3,80}",
                                          message = "must contain 3-80 letters, numbers, dots, underscores or hyphens")
                                  String username,
                                  @NotBlank @Email @Size(max = 254) String email,
                                  @NotBlank @Size(min = 12, max = 72) String password) {}
    public record LoginRequest(@NotBlank @Size(max = 254) String usernameOrEmail,
                               @NotBlank @Size(max = 200) String password) {}
    public record GoogleLoginRequest(@NotBlank @Size(max = 8192) String credential) {}
    public record RefreshRequest(@NotBlank @Size(max = 1024) String refreshToken) {}
    public record LogoutRequest(@NotBlank @Size(max = 1024) String refreshToken, boolean allDevices) {}
    public record ChangePasswordRequest(@NotBlank @Size(max = 72) String currentPassword,
                                        @NotBlank @Size(min = 12, max = 72) String newPassword) {}
}
