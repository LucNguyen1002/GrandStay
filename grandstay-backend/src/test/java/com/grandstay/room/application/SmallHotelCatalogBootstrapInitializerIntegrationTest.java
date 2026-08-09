package com.grandstay.room.application;

import java.math.BigDecimal;

import com.grandstay.room.infrastructure.AmenityRepository;
import com.grandstay.room.infrastructure.FloorRepository;
import com.grandstay.room.infrastructure.RatePlanRepository;
import com.grandstay.room.infrastructure.RoomRepository;
import com.grandstay.room.infrastructure.RoomTypeAmenityRepository;
import com.grandstay.room.infrastructure.RoomTypeRepository;
import com.grandstay.service.infrastructure.HotelServiceRepository;
import com.grandstay.shared.domain.ModelEnums.RoomOperationalStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "grandstay.catalog.bootstrap.enabled=true")
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class SmallHotelCatalogBootstrapInitializerIntegrationTest {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired FloorRepository floors;
    @Autowired RoomTypeRepository roomTypes;
    @Autowired RoomRepository rooms;
    @Autowired RatePlanRepository ratePlans;
    @Autowired AmenityRepository amenities;
    @Autowired RoomTypeAmenityRepository roomTypeAmenities;
    @Autowired HotelServiceRepository services;

    @Test
    void seedsManageableSmallHotelCatalog() {
        assertThat(floors.count()).isEqualTo(3);
        assertThat(roomTypes.count()).isEqualTo(4);
        assertThat(rooms.count()).isEqualTo(24);
        assertThat(ratePlans.count()).isEqualTo(12);
        assertThat(amenities.count()).isEqualTo(11);
        assertThat(roomTypeAmenities.count()).isEqualTo(33);
        assertThat(services.count()).isEqualTo(7);

        assertThat(rooms.findAll())
                .allMatch(room -> room.getOperationalStatus() == RoomOperationalStatus.AVAILABLE)
                .extracting(room -> room.getRoomNumber())
                .contains("101", "108", "208", "301", "308");

        assertThat(roomTypes.findAll())
                .extracting(type -> type.getCode())
                .containsExactlyInAnyOrder("STD", "SUP", "DLX", "FAM");
        assertThat(roomTypes.findAll())
                .filteredOn(type -> type.getCode().equals("STD"))
                .singleElement()
                .extracting(type -> type.getBaseNightlyRate())
                .isEqualTo(new BigDecimal("720000.00"));
    }
}
