package com.grandstay.realtime.infrastructure;

import com.grandstay.realtime.application.RealtimeUpdateHub;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class RealtimeMutationFilterTest {
    private final RealtimeUpdateHub hub = mock(RealtimeUpdateHub.class);
    private final RealtimeMutationFilter filter = new RealtimeMutationFilter(hub);

    @Test
    void publishesAfterSuccessfulDomainMutation() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/bookings/booking-1/check-out");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        verify(hub).publish("bookings");
    }

    @Test
    void ignoresReadRequestsAndFailedMutations() throws Exception {
        MockHttpServletRequest read = new MockHttpServletRequest("GET", "/api/v1/dashboard");
        filter.doFilter(read, new MockHttpServletResponse(), new MockFilterChain());

        MockHttpServletRequest failed = new MockHttpServletRequest("POST", "/api/v1/bookings/booking-1/check-out");
        MockHttpServletResponse failedResponse = new MockHttpServletResponse();
        failedResponse.setStatus(409);
        filter.doFilter(failed, failedResponse, new MockFilterChain());

        verifyNoInteractions(hub);
    }

    @Test
    void publishesVnPayGetCallbacksThatCanCompletePayments() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/payments/vnpay/ipn");

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        verify(hub).publish("payments");
    }
}
