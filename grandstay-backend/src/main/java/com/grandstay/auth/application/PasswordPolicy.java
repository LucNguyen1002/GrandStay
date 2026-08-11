package com.grandstay.auth.application;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Shared password rules for registration, password changes and admin-created accounts. */
public final class PasswordPolicy {
    private PasswordPolicy() {}

    public static boolean isStrong(String password, String username, String email) {
        if (password == null || password.length() < 12 || password.length() > 72
                || password.getBytes(StandardCharsets.UTF_8).length > 72
                || password.chars().noneMatch(Character::isUpperCase)
                || password.chars().noneMatch(Character::isLowerCase)
                || password.chars().noneMatch(Character::isDigit)
                || password.chars().allMatch(Character::isLetterOrDigit)) {
            return false;
        }
        String normalized = password.toLowerCase(Locale.ROOT);
        String normalizedUsername = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        String emailName = email == null ? "" : email.substring(0, Math.max(0, email.indexOf('@'))).toLowerCase(Locale.ROOT);
        return (normalizedUsername.length() < 3 || !normalized.contains(normalizedUsername))
                && (emailName.length() < 3 || !normalized.contains(emailName));
    }
}
