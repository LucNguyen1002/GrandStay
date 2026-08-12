package com.grandstay.service.application;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import com.grandstay.service.domain.HotelService;
import com.grandstay.service.infrastructure.HotelServiceRepository;
import com.grandstay.shared.dto.EntityDtos.ServiceDto;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServiceCatalogApplicationServiceTest {
    @Mock HotelServiceRepository repository;
    @Mock EntityMapper mapper;

    @Test
    void includesInactiveServicesOnlyWhenCatalogRequestsThem() {
        var pageable = PageRequest.of(0, 20);
        HotelService inactive = new HotelService();
        inactive.setId(UUID.randomUUID());
        inactive.setCode("BREAKFAST");
        inactive.setName("Bữa sáng");
        inactive.setActive(false);
        ServiceDto dto = new ServiceDto(inactive.getId(), "BREAKFAST", "Bữa sáng", "FOOD",
                null, "Suất", null, null, "VND", false, 0);
        when(repository.findAllByDeletedAtIsNull(pageable)).thenReturn(new PageImpl<>(List.of(inactive)));
        when(mapper.toDto(inactive)).thenReturn(dto);

        var result = new ServiceCatalogApplicationService(repository, mapper, Clock.systemUTC())
                .list(pageable, true);

        assertThat(result.getContent()).containsExactly(dto);
        verify(repository).findAllByDeletedAtIsNull(pageable);
    }

    @Test
    void keepsOperationalSelectorsLimitedToActiveServices() {
        var pageable = PageRequest.of(0, 20);
        when(repository.findAllByActiveTrueAndDeletedAtIsNull(pageable))
                .thenReturn(new PageImpl<>(List.of()));

        new ServiceCatalogApplicationService(repository, mapper, Clock.systemUTC())
                .list(pageable, false);

        verify(repository).findAllByActiveTrueAndDeletedAtIsNull(pageable);
    }

    @Test
    void pausingAServiceKeepsItVisibleForLaterRestoration() {
        HotelService service = new HotelService();
        service.setId(UUID.randomUUID());
        service.setActive(true);
        when(repository.findById(service.getId())).thenReturn(java.util.Optional.of(service));

        new ServiceCatalogApplicationService(repository, mapper, Clock.systemUTC())
                .pause(service.getId());

        assertThat(service.isActive()).isFalse();
        assertThat(service.getDeletedAt()).isNull();
        verify(repository).save(service);
    }
}
