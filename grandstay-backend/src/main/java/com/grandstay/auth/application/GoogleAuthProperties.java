package com.grandstay.auth.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "grandstay.security.google")
public class GoogleAuthProperties {
    private String clientId;
    private String jwkSetUri = "https://www.googleapis.com/oauth2/v3/certs";

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getJwkSetUri() { return jwkSetUri; }
    public void setJwkSetUri(String jwkSetUri) { this.jwkSetUri = jwkSetUri; }
    public boolean isConfigured() { return clientId != null && !clientId.isBlank(); }
}
