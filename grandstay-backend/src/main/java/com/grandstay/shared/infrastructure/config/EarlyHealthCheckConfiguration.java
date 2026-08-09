package com.grandstay.shared.infrastructure.config;

import java.io.IOException;

import jakarta.servlet.Filter;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
public class EarlyHealthCheckConfiguration {

    @Bean
    FilterRegistrationBean<Filter> earlyHealthCheckFilter() {
        FilterRegistrationBean<Filter> registration = new FilterRegistrationBean<>();
        registration.setName("earlyHealthCheckFilter");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registration.addUrlPatterns("/healthz");
        registration.setFilter(this::respondHealthy);
        return registration;
    }

    private void respondHealthy(ServletRequest request, ServletResponse response,
                                jakarta.servlet.FilterChain chain)
            throws IOException, ServletException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"status\":\"UP\"}");
    }
}
