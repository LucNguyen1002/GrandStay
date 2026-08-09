package com.grandstay.shared.infrastructure.config;

import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class PersistenceConfiguration {

    @Bean
    AuditorAware<UUID> auditorProvider() {
        return () -> {
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            if (!(authentication instanceof JwtAuthenticationToken jwt) || !authentication.isAuthenticated()) {
                return Optional.empty();
            }
            try {
                return Optional.of(UUID.fromString(jwt.getToken().getSubject()));
            } catch (IllegalArgumentException exception) {
                return Optional.empty();
            }
        };
    }
}
