package com.grandstay.auth.application;

public final class AuthCommands {
    private AuthCommands() {}

    public record Register(String fullName, String username, String email, String password,
                           String userAgent, String ipAddress) {}
    public record Login(String usernameOrEmail, String password, String userAgent, String ipAddress) {}
    public record GoogleLogin(String credential, String userAgent, String ipAddress) {}
    public record Refresh(String refreshToken, String userAgent, String ipAddress) {}
    public record Logout(String refreshToken, boolean revokeFamily) {}
    public record ChangePassword(java.util.UUID userId, String currentPassword, String newPassword) {}
}
