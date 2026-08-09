package com.grandstay.auth.application;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "grandstay.security.rate-limit")
public class AuthRateLimitProperties {
    private int loginAttempts = 5;
    private Duration loginWindow = Duration.ofMinutes(1);
    private int refreshAttempts = 30;
    private Duration refreshWindow = Duration.ofMinutes(1);
    private int accountFailureLimit = 5;
    private Duration accountLockDuration = Duration.ofMinutes(15);

    public int getLoginAttempts() { return loginAttempts; }
    public void setLoginAttempts(int value) { loginAttempts = value; }
    public Duration getLoginWindow() { return loginWindow; }
    public void setLoginWindow(Duration value) { loginWindow = value; }
    public int getRefreshAttempts() { return refreshAttempts; }
    public void setRefreshAttempts(int value) { refreshAttempts = value; }
    public Duration getRefreshWindow() { return refreshWindow; }
    public void setRefreshWindow(Duration value) { refreshWindow = value; }
    public int getAccountFailureLimit() { return accountFailureLimit; }
    public void setAccountFailureLimit(int value) { accountFailureLimit = value; }
    public Duration getAccountLockDuration() { return accountLockDuration; }
    public void setAccountLockDuration(Duration value) { accountLockDuration = value; }
}
