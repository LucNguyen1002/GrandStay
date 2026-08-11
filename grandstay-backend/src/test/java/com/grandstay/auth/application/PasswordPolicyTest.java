package com.grandstay.auth.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PasswordPolicyTest {
    @Test
    void acceptsOnlyStrongPasswordsThatDoNotContainAccountIdentifiers() {
        assertTrue(PasswordPolicy.isStrong("River!Stone2026", "lucnguyen", "luc@example.com"));
        assertFalse(PasswordPolicy.isStrong("short!A1", "lucnguyen", "luc@example.com"));
        assertFalse(PasswordPolicy.isStrong("alllowercase!2026", "lucnguyen", "luc@example.com"));
        assertFalse(PasswordPolicy.isStrong("LucNguyen!2026", "lucnguyen", "luc@example.com"));
        assertFalse(PasswordPolicy.isStrong("WelcomeLuc!2026", "guest", "luc@example.com"));
    }
}
