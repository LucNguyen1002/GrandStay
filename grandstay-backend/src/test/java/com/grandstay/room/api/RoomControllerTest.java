package com.grandstay.room.api;

import java.util.List;
import java.util.UUID;

import com.grandstay.room.application.RoomCatalogApplicationService;
import com.grandstay.room.application.RoomMatrixRow;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RoomControllerTest {
    @Test
    void hidesBookingIdentityFromRoomOnlyAccounts() {
        RoomCatalogApplicationService service = mock(RoomCatalogApplicationService.class);
        RoomMatrixRow row = roomWithBooking();
        when(service.matrix(null)).thenReturn(List.of(row));
        RoomController controller = new RoomController(service);

        var customer = new TestingAuthenticationToken("guest", "", "room:read", "ROLE_CUSTOMER");

        assertThat(controller.matrix(null, customer)).singleElement()
                .extracting(RoomController.RoomMatrixResponse::bookingId).isNull();
    }

    @Test
    void keepsBookingIdentityForAuthorizedStaff() {
        RoomCatalogApplicationService service = mock(RoomCatalogApplicationService.class);
        RoomMatrixRow row = roomWithBooking();
        when(service.matrix(null)).thenReturn(List.of(row));
        RoomController controller = new RoomController(service);

        var staff = new TestingAuthenticationToken("staff", "", "room:read", "booking:read");

        assertThat(controller.matrix(null, staff)).singleElement()
                .extracting(RoomController.RoomMatrixResponse::bookingId).isEqualTo(row.getBookingId());
    }

    private RoomMatrixRow roomWithBooking() {
        RoomMatrixRow row = mock(RoomMatrixRow.class);
        when(row.getRoomId()).thenReturn(UUID.randomUUID());
        when(row.getRoomNumber()).thenReturn("101");
        when(row.getFloorId()).thenReturn(UUID.randomUUID());
        when(row.getFloorName()).thenReturn("Floor 1");
        when(row.getFloorNumber()).thenReturn(1);
        when(row.getRoomTypeId()).thenReturn(UUID.randomUUID());
        when(row.getRoomTypeName()).thenReturn("Deluxe");
        when(row.getDisplayStatus()).thenReturn("RESERVED");
        when(row.getBookingId()).thenReturn(UUID.randomUUID());
        return row;
    }
}
