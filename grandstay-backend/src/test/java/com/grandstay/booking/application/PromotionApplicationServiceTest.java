package com.grandstay.booking.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.booking.application.PromotionApplicationService.Command;
import com.grandstay.booking.domain.Promotion;
import com.grandstay.booking.infrastructure.PromotionRepository;
import com.grandstay.shared.domain.ModelEnums.DiscountType;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromotionApplicationServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-09T04:00:00Z");
    @Mock PromotionRepository promotions;
    @Mock EntityMapper mapper;
    PromotionApplicationService service;

    @BeforeEach
    void setUp() {
        service = new PromotionApplicationService(promotions, mapper, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void listsOnlyCurrentlyAvailablePromotionsForBookingForm() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        when(promotions.findAvailable(NOW, pageable)).thenReturn(org.springframework.data.domain.Page.empty());

        service.list(pageable, false);

        verify(promotions).findAvailable(NOW, pageable);
    }

    @Test
    void rejectsPercentageAboveOneHundred() {
        Command command = command(DiscountType.PERCENTAGE, new BigDecimal("101"), null);

        assertThatThrownBy(() -> service.create(command))
                .isInstanceOfSatisfying(BusinessException.class,
                        error -> assertThat(error.getMessage()).isEqualTo("Percentage discount cannot exceed 100"));
    }

    @Test
    void refusesToLowerUsageLimitBelowUsedCount() {
        UUID id = UUID.randomUUID();
        Promotion promotion = new Promotion();
        promotion.setId(id);
        promotion.setUsedCount(5);
        when(promotions.findById(id)).thenReturn(Optional.of(promotion));

        assertThatThrownBy(() -> service.update(id,
                command(DiscountType.FIXED_AMOUNT, new BigDecimal("50000"), 4)))
                .isInstanceOfSatisfying(BusinessException.class,
                        error -> assertThat(error.getMessage()).isEqualTo("Usage limit cannot be lower than the used count"));
    }

    private static Command command(DiscountType type, BigDecimal value, Integer limit) {
        return new Command("SUMMER", "Ưu đãi mùa hè", null, type, value,
                new BigDecimal("200000"), BigDecimal.ZERO,
                NOW.minusSeconds(3600), NOW.plusSeconds(3600), limit, true);
    }
}
