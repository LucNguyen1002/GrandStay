package com.grandstay.shared.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicBoolean;

import jakarta.servlet.Filter;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class EarlyHealthCheckConfigurationTest {

    @Test
    void respondsWithoutStartingTheDispatcherChain() throws Exception {
        EarlyHealthCheckConfiguration configuration = new EarlyHealthCheckConfiguration();
        FilterRegistrationBean<Filter> registration =
                configuration.earlyHealthCheckFilter();
        Filter filter = registration.getFilter();
        AtomicBoolean continued = new AtomicBoolean(false);

        MockHttpServletResponse startingResponse = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/healthz"), startingResponse,
                (request, result) -> continued.set(true));

        assertThat(startingResponse.getStatus()).isEqualTo(503);
        assertThat(startingResponse.getContentAsString()).isEqualTo("{\"status\":\"STARTING\"}");

        configuration.markReady();
        MockHttpServletResponse readyResponse = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/healthz"), readyResponse,
                (request, result) -> continued.set(true));

        assertThat(readyResponse.getStatus()).isEqualTo(200);
        assertThat(readyResponse.getContentType()).isEqualTo("application/json;charset=UTF-8");
        assertThat(readyResponse.getContentAsString()).isEqualTo("{\"status\":\"UP\"}");
        assertThat(continued).isFalse();
        assertThat(registration.getUrlPatterns()).containsExactlyInAnyOrder("/", "/healthz");
    }
}
