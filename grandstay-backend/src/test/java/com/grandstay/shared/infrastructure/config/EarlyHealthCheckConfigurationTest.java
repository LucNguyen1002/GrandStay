package com.grandstay.shared.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicBoolean;

import jakarta.servlet.Filter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class EarlyHealthCheckConfigurationTest {

    @Test
    void respondsWithoutStartingTheDispatcherChain() throws Exception {
        Filter filter = new EarlyHealthCheckConfiguration().earlyHealthCheckFilter().getFilter();
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean continued = new AtomicBoolean(false);

        filter.doFilter(new MockHttpServletRequest("GET", "/healthz"), response,
                (request, result) -> continued.set(true));

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getContentType()).isEqualTo("application/json;charset=UTF-8");
        assertThat(response.getContentAsString()).isEqualTo("{\"status\":\"UP\"}");
        assertThat(continued).isFalse();
    }
}
