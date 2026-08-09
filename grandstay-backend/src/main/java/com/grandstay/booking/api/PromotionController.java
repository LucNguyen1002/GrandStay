package com.grandstay.booking.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.grandstay.booking.application.PromotionApplicationService;
import com.grandstay.booking.application.PromotionApplicationService.Command;
import com.grandstay.shared.domain.ModelEnums.DiscountType;
import com.grandstay.shared.dto.EntityDtos.PromotionDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/promotions")
@Tag(name = "Promotions")
public class PromotionController {
    private final PromotionApplicationService service;

    public PromotionController(PromotionApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('promotion:read')")
    public Page<PromotionDto> list(@RequestParam(defaultValue = "false") boolean includeInactive,
                                   @ParameterObject @PageableDefault(size = 50, sort = "validTo") Pageable pageable) {
        return service.list(pageable, includeInactive);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('promotion:write')")
    public PromotionDto create(@Valid @RequestBody PromotionRequest request) {
        return service.create(request.command());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('promotion:write')")
    public PromotionDto update(@PathVariable UUID id, @Valid @RequestBody PromotionRequest request) {
        return service.update(id, request.command());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('promotion:write')")
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    public record PromotionRequest(@NotBlank @Size(max = 50) String code,
                                   @NotBlank @Size(max = 150) String name,
                                   @Size(max = 1000) String description,
                                   @NotNull DiscountType discountType,
                                   @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal discountValue,
                                   @DecimalMin("0") BigDecimal maximumDiscount,
                                   @NotNull @DecimalMin("0") BigDecimal minimumBookingAmount,
                                   @NotNull Instant validFrom,
                                   @NotNull Instant validTo,
                                   @jakarta.validation.constraints.Min(1) Integer usageLimit,
                                   boolean active) {
        Command command() {
            return new Command(code, name, description, discountType, discountValue,
                    maximumDiscount, minimumBookingAmount, validFrom, validTo, usageLimit, active);
        }
    }
}
