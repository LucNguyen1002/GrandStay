package com.grandstay.room.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import com.grandstay.room.application.RoomCatalogApplicationService;
import com.grandstay.room.application.RoomCatalogApplicationService.RatePlanCommand;
import com.grandstay.shared.domain.ModelEnums.PricingUnit;
import com.grandstay.shared.dto.EntityDtos.RatePlanDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/rate-plans")
@Tag(name = "Rate Plans")
public class RatePlanController {
    private final RoomCatalogApplicationService service;
    public RatePlanController(RoomCatalogApplicationService service) { this.service = service; }

    @GetMapping
    @PreAuthorize("hasAuthority('room:read')")
    public Page<RatePlanDto> list(@RequestParam(required = false) UUID roomTypeId,
                                  @ParameterObject @PageableDefault(size = 100, sort = "name") Pageable pageable) {
        return service.ratePlans(roomTypeId, pageable);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('room:write')")
    public RatePlanDto create(@Valid @RequestBody RatePlanRequest request) {
        return service.createRate(request.command());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('room:write')")
    public RatePlanDto update(@PathVariable UUID id, @Valid @RequestBody RatePlanRequest request) {
        return service.updateRate(id, request.command());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('room:write')")
    public void delete(@PathVariable UUID id) {
        service.deleteRate(id);
    }

    public record RatePlanRequest(@NotNull UUID roomTypeId, @NotBlank @Size(max = 50) String code,
            @NotBlank @Size(max = 100) String name, @NotNull PricingUnit pricingUnit,
            @NotNull @DecimalMin("0") BigDecimal rate,
            @NotBlank @Pattern(regexp = "[A-Za-z]{3}") String currency,
            LocalDate validFrom, LocalDate validTo, @Min(1) int minStayUnits,
            boolean refundable, boolean active) {
        RatePlanCommand command() {
            return new RatePlanCommand(roomTypeId, code, name, pricingUnit, rate, currency,
                    validFrom, validTo, minStayUnits, refundable, active);
        }
    }
}
