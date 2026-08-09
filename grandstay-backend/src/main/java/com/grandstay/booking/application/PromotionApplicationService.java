package com.grandstay.booking.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import com.grandstay.booking.domain.Promotion;
import com.grandstay.booking.infrastructure.PromotionRepository;
import com.grandstay.shared.domain.ModelEnums.DiscountType;
import com.grandstay.shared.dto.EntityDtos.PromotionDto;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PromotionApplicationService {
    private final PromotionRepository promotions;
    private final EntityMapper mapper;
    private final Clock clock;

    public PromotionApplicationService(PromotionRepository promotions, EntityMapper mapper, Clock clock) {
        this.promotions = promotions;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<PromotionDto> list(Pageable pageable, boolean includeInactive) {
        return (includeInactive
                ? promotions.findAllByDeletedAtIsNull(pageable)
                : promotions.findAvailable(clock.instant(), pageable)).map(mapper::toDto);
    }

    @Transactional
    public PromotionDto create(Command command) {
        validate(command, 0);
        Promotion promotion = new Promotion();
        promotion.setUsedCount(0);
        apply(promotion, command);
        return mapper.toDto(promotions.save(promotion));
    }

    @Transactional
    public PromotionDto update(UUID id, Command command) {
        Promotion promotion = active(id);
        validate(command, promotion.getUsedCount());
        apply(promotion, command);
        return mapper.toDto(promotions.save(promotion));
    }

    @Transactional
    public void delete(UUID id) {
        Promotion promotion = active(id);
        promotion.setActive(false);
        promotion.setDeletedAt(clock.instant());
        promotions.save(promotion);
    }

    private Promotion active(UUID id) {
        return promotions.findById(id).filter(item -> item.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("Promotion", id));
    }

    private void validate(Command command, int usedCount) {
        if (!command.validTo().isAfter(command.validFrom())) {
            throw BusinessException.invalid("Promotion end time must be after start time");
        }
        if (command.discountType() == DiscountType.PERCENTAGE
                && command.discountValue().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw BusinessException.invalid("Percentage discount cannot exceed 100");
        }
        if (command.usageLimit() != null && command.usageLimit() < usedCount) {
            throw BusinessException.invalid("Usage limit cannot be lower than the used count");
        }
    }

    private void apply(Promotion promotion, Command command) {
        promotion.setCode(command.code().trim().toUpperCase(Locale.ROOT));
        promotion.setName(command.name().trim());
        promotion.setDescription(blankToNull(command.description()));
        promotion.setDiscountType(command.discountType());
        promotion.setDiscountValue(command.discountValue());
        promotion.setMaximumDiscount(command.maximumDiscount());
        promotion.setMinimumBookingAmount(command.minimumBookingAmount());
        promotion.setValidFrom(command.validFrom());
        promotion.setValidTo(command.validTo());
        promotion.setUsageLimit(command.usageLimit());
        promotion.setActive(command.active());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record Command(String code, String name, String description, DiscountType discountType,
                          BigDecimal discountValue, BigDecimal maximumDiscount,
                          BigDecimal minimumBookingAmount, Instant validFrom, Instant validTo,
                          Integer usageLimit, boolean active) {}
}
