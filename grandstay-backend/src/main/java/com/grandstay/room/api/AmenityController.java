package com.grandstay.room.api;

import java.util.List;
import java.util.UUID;

import com.grandstay.room.application.AmenityCatalogApplicationService;
import com.grandstay.room.application.AmenityCatalogApplicationService.AmenityView;
import com.grandstay.room.application.AmenityCatalogApplicationService.AssignmentCommand;
import com.grandstay.room.application.AmenityCatalogApplicationService.Command;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
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
@RequestMapping("/api/v1/amenities")
@Tag(name = "Amenities")
public class AmenityController {
    private final AmenityCatalogApplicationService service;

    public AmenityController(AmenityCatalogApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('room:read')")
    public Page<AmenityView> list(@ParameterObject @PageableDefault(size = 50, sort = "name") Pageable pageable) {
        return service.list(pageable);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('room:write')")
    public AmenityView create(@Valid @RequestBody AmenityRequest request) {
        return service.create(request.command());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('room:write')")
    public AmenityView update(@PathVariable UUID id, @Valid @RequestBody AmenityRequest request) {
        return service.update(id, request.command());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('room:write')")
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    public record AmenityRequest(@NotBlank @Size(max = 50) String code,
                                 @NotBlank @Size(max = 100) String name,
                                 @Size(max = 500) String description,
                                 @Size(max = 100) String icon,
                                 @NotNull List<@Valid AssignmentRequest> roomTypes) {
        Command command() {
            return new Command(code, name, description, icon, roomTypes.stream()
                    .map(item -> new AssignmentCommand(item.roomTypeId(), item.quantity())).toList());
        }
    }

    public record AssignmentRequest(@NotNull UUID roomTypeId, @Min(1) int quantity) {}
}
