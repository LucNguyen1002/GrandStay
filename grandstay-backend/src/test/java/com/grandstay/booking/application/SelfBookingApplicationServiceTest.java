package com.grandstay.booking.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.grandstay.booking.application.BookingCommands.CreateBooking;
import com.grandstay.booking.application.BookingCommands.GuestInput;
import com.grandstay.booking.application.BookingCommands.RoomSelection;
import com.grandstay.booking.application.SelfBookingApplicationService.CreateSelfBooking;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.customer.application.CustomerIdentityService;
import com.grandstay.customer.domain.Customer;
import com.grandstay.shared.domain.ModelEnums.BookingSource;
import com.grandstay.shared.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SelfBookingApplicationServiceTest {
    @Mock CustomerIdentityService identities;
    @Mock BookingApplicationService bookings;
    @Mock BookingQueryService queries;
    @Mock BookingRepository bookingRepository;
    SelfBookingApplicationService service;
    UUID userId;
    Customer customer;

    @BeforeEach
    void setUp() {
        service = new SelfBookingApplicationService(identities, bookings, queries, bookingRepository);
        userId = UUID.randomUUID();
        customer = new Customer();
        customer.setId(UUID.randomUUID());
        customer.setFullName("Customer Owner");
        customer.setNationality("VN");
        when(identities.resolve(userId)).thenReturn(customer);
    }

    @Test
    void createsAnOnlineBookingOwnedByTheAuthenticatedCustomer() {
        UUID roomId = UUID.randomUUID();
        UUID ratePlanId = UUID.randomUUID();
        CreateSelfBooking command = new CreateSelfBooking(null,
                Instant.parse("2030-01-01T07:00:00Z"), Instant.parse("2030-01-02T07:00:00Z"),
                1, 0, null, List.of(new RoomSelection(roomId, ratePlanId, 1, 0)),
                List.of(new GuestInput(null, "Companion", false, "VN", null)));

        service.create(userId, command);

        ArgumentCaptor<CreateBooking> captor = ArgumentCaptor.forClass(CreateBooking.class);
        verify(bookings).create(captor.capture());
        CreateBooking created = captor.getValue();
        assertThat(created.customerId()).isEqualTo(customer.getId());
        assertThat(created.source()).isEqualTo(BookingSource.ONLINE);
        assertThat(created.confirmImmediately()).isTrue();
        assertThat(created.currency()).isEqualTo("VND");
        assertThat(created.guests()).hasSize(2);
        assertThat(created.guests().get(0).customerId()).isEqualTo(customer.getId());
        assertThat(created.guests().get(0).primary()).isTrue();
    }

    @Test
    void hidesBookingsOwnedByAnotherCustomer() {
        UUID foreignBookingId = UUID.randomUUID();
        when(bookingRepository.existsByIdAndCustomerId(foreignBookingId, customer.getId())).thenReturn(false);

        assertThatThrownBy(() -> service.get(userId, foreignBookingId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not found");

        verify(queries, never()).get(foreignBookingId);
    }
}
