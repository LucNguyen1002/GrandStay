package com.grandstay.room.application;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.room.domain.Floor;
import com.grandstay.room.domain.Room;
import com.grandstay.room.infrastructure.FloorRepository;
import com.grandstay.room.infrastructure.RatePlanRepository;
import com.grandstay.room.infrastructure.RoomRepository;
import com.grandstay.room.infrastructure.RoomTypeRepository;
import com.grandstay.shared.domain.ModelEnums.RoomOperationalStatus;
import com.grandstay.shared.dto.EntityDtos.FloorDto;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomCatalogApplicationServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-07T12:00:00Z");

    @Mock FloorRepository floors;
    @Mock RoomTypeRepository types;
    @Mock RoomRepository rooms;
    @Mock RatePlanRepository rates;
    @Mock EntityMapper mapper;
    RoomCatalogApplicationService service;

    @BeforeEach
    void setUp() {
        service = new RoomCatalogApplicationService(floors, types, rooms, rates, mapper,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void listsOnlyFloorsThatHaveNotBeenDeleted() {
        var pageable = PageRequest.of(0, 20);
        Floor floor = floor();
        FloorDto dto = new FloorDto(floor.getId(), "F1", "Tầng 1", 1, null, 0);
        when(floors.findAllByDeletedAtIsNull(pageable)).thenReturn(new PageImpl<>(List.of(floor)));
        when(mapper.toDto(floor)).thenReturn(dto);

        assertThat(service.floors(pageable).getContent()).containsExactly(dto);
        verify(floors).findAllByDeletedAtIsNull(pageable);
    }

    @Test
    void softDeletesRoomAndMarksItOutOfService() {
        UUID id = UUID.randomUUID();
        Room room = new Room();
        room.setId(id);
        room.setOperationalStatus(RoomOperationalStatus.AVAILABLE);
        when(rooms.findById(id)).thenReturn(Optional.of(room));
        when(rooms.hasActiveAllocation(id)).thenReturn(false);

        service.deleteRoom(id);

        assertThat(room.getDeletedAt()).isEqualTo(NOW);
        assertThat(room.getOperationalStatus()).isEqualTo(RoomOperationalStatus.OUT_OF_SERVICE);
        verify(rooms).save(room);
    }

    @Test
    void refusesToDeleteRoomUsedByActiveBooking() {
        UUID id = UUID.randomUUID();
        Room room = new Room();
        room.setId(id);
        when(rooms.findById(id)).thenReturn(Optional.of(room));
        when(rooms.hasActiveAllocation(id)).thenReturn(true);

        assertThatThrownBy(() -> service.deleteRoom(id))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getMessage())
                                .isEqualTo("Room has an active booking and cannot be deleted"));
        verify(rooms, never()).save(room);
    }

    @Test
    void refusesToDeleteFloorWhileItStillContainsRooms() {
        Floor floor = floor();
        when(floors.findById(floor.getId())).thenReturn(Optional.of(floor));
        when(rooms.existsByFloorIdAndDeletedAtIsNull(floor.getId())).thenReturn(true);

        assertThatThrownBy(() -> service.deleteFloor(floor.getId()))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getMessage())
                                .isEqualTo("Floor still contains active rooms"));
        verify(floors, never()).save(floor);
    }

    private static Floor floor() {
        Floor floor = new Floor();
        floor.setId(UUID.randomUUID());
        floor.setCode("F1");
        floor.setName("Tầng 1");
        floor.setFloorNumber(1);
        return floor;
    }
}
