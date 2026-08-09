package com.grandstay.room.api;

import java.util.UUID;

import com.grandstay.room.application.RoomCatalogApplicationService;
import com.grandstay.room.application.RoomCatalogApplicationService.FloorCommand;
import com.grandstay.shared.dto.EntityDtos.FloorDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/floors")
@Tag(name = "Floors")
public class FloorController {
    private final RoomCatalogApplicationService service;
    public FloorController(RoomCatalogApplicationService service) { this.service = service; }

    @GetMapping
    @PreAuthorize("hasAuthority('room:read')")
    public Page<FloorDto> list(@ParameterObject @PageableDefault(size = 100, sort = "floorNumber") Pageable pageable) {
        return service.floors(pageable);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('room:write')")
    public FloorDto create(@Valid @RequestBody FloorRequest request) {
        return service.createFloor(new FloorCommand(request.code(), request.name(), request.floorNumber(), request.description()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('room:write')")
    public FloorDto update(@PathVariable UUID id, @Valid @RequestBody FloorRequest request) {
        return service.updateFloor(id,
                new FloorCommand(request.code(), request.name(), request.floorNumber(), request.description()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('room:write')")
    public void delete(@PathVariable UUID id) {
        service.deleteFloor(id);
    }

    public record FloorRequest(@NotBlank @Size(max = 30) String code,
                               @NotBlank @Size(max = 100) String name,
                               int floorNumber,
                               @Size(max = 500) String description) {}
}
