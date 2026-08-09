package com.grandstay.shared.infrastructure.config;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;

import jakarta.servlet.Filter;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;

@Configuration
public class EarlyHealthCheckConfiguration {
    private final AtomicBoolean ready = new AtomicBoolean(false);

    @Bean
    FilterRegistrationBean<Filter> earlyHealthCheckFilter() {
        FilterRegistrationBean<Filter> registration = new FilterRegistrationBean<>();
        registration.setName("earlyHealthCheckFilter");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registration.addUrlPatterns("/", "/healthz");
        registration.setFilter(this::respondHealthy);
        return registration;
    }

    private void respondHealthy(ServletRequest request, ServletResponse response,
                                jakarta.servlet.FilterChain chain)
            throws IOException, ServletException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        if (ready.get()) {
            ((HttpServletResponse) response).setStatus(HttpServletResponse.SC_OK);
            response.getWriter().write("{\"status\":\"UP\"}");
        } else {
            ((HttpServletResponse) response).setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.getWriter().write("{\"status\":\"STARTING\"}");
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    void markReady() {
        ready.set(true);
    }

    @EventListener(ContextClosedEvent.class)
    void markNotReady() {
        ready.set(false);
    }
}
