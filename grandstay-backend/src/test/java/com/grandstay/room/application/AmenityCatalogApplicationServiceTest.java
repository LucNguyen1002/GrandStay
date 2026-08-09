package com.grandstay.room.application;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.room.application.AmenityCatalogApplicationService.AssignmentCommand;
import com.grandstay.room.application.AmenityCatalogApplicationService.Command;
import com.grandstay.room.domain.Amenity;
import com.grandstay.room.domain.RoomType;
import com.grandstay.room.infrastructure.AmenityRepository;
import com.grandstay.room.infrastructure.RoomTypeAmenityRepository;
import com.grandstay.room.infrastructure.RoomTypeRepository;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AmenityCatalogApplicationServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-09T04:00:00Z");
    @Mock AmenityRepository amenities;
    @Mock RoomTypeAmenityRepository assignments;
    @Mock RoomTypeRepository roomTypes;
    @Mock EntityMapper mapper;
    AmenityCatalogApplicationService service;

    @BeforeEach
    void setUp() {
        service = new AmenityCatalogApplicationService(amenities, assignments, roomTypes, mapper,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void createsAmenityAndReplacesRoomTypeAssignments() {
        UUID roomTypeId = UUID.randomUUID();
        RoomType roomType = new RoomType();
        roomType.setId(roomTypeId);
        when(roomTypes.findAllById(any())).thenReturn(List.of(roomType));
        when(amenities.save(any(Amenity.class))).thenAnswer(invocation -> {
            Amenity item = invocation.getArgument(0);
            item.setId(UUID.randomUUID());
            return item;
        });

        service.create(new Command(" wifi ", " Wi-Fi ", "Kết nối", "wifi",
                List.of(new AssignmentCommand(roomTypeId, 1))));

        verify(assignments).deleteAllByIdAmenityId(any(UUID.class));
        verify(assignments).saveAll(any());
    }

    @Test
    void rejectsDuplicateRoomTypeAssignments() {
        UUID roomTypeId = UUID.randomUUID();
        Command command = new Command("WIFI", "Wi-Fi", null, null,
                List.of(new AssignmentCommand(roomTypeId, 1), new AssignmentCommand(roomTypeId, 2)));

        assertThatThrownBy(() -> service.create(command))
                .isInstanceOfSatisfying(BusinessException.class,
                        error -> assertThat(error.getMessage()).isEqualTo("Each room type can only be assigned once"));
    }

    @Test
    void softDeletesAmenityAndRemovesAssignments() {
        UUID id = UUID.randomUUID();
        Amenity amenity = new Amenity();
        amenity.setId(id);
        when(amenities.findById(id)).thenReturn(Optional.of(amenity));

        service.delete(id);

        assertThat(amenity.getDeletedAt()).isEqualTo(NOW);
        verify(assignments).deleteAllByIdAmenityId(id);
        verify(amenities).save(amenity);
    }
}
