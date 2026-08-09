package com.grandstay.room.application;

import java.time.Clock;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.grandstay.room.domain.Amenity;
import com.grandstay.room.domain.RoomTypeAmenity;
import com.grandstay.room.domain.RoomTypeAmenityId;
import com.grandstay.room.infrastructure.AmenityRepository;
import com.grandstay.room.infrastructure.RoomTypeAmenityRepository;
import com.grandstay.room.infrastructure.RoomTypeRepository;
import com.grandstay.shared.dto.EntityDtos.AmenityDto;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AmenityCatalogApplicationService {
    private final AmenityRepository amenities;
    private final RoomTypeAmenityRepository assignments;
    private final RoomTypeRepository roomTypes;
    private final EntityMapper mapper;
    private final Clock clock;

    public AmenityCatalogApplicationService(AmenityRepository amenities,
                                            RoomTypeAmenityRepository assignments,
                                            RoomTypeRepository roomTypes,
                                            EntityMapper mapper,
                                            Clock clock) {
        this.amenities = amenities;
        this.assignments = assignments;
        this.roomTypes = roomTypes;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<AmenityView> list(Pageable pageable) {
        Page<Amenity> page = amenities.findAllByDeletedAtIsNull(pageable);
        List<UUID> amenityIds = page.getContent().stream().map(Amenity::getId).toList();
        Map<UUID, List<AssignmentView>> byAmenity = amenityIds.isEmpty() ? Map.of() : assignments
                .findAllByIdAmenityIdIn(amenityIds).stream()
                .collect(Collectors.groupingBy(item -> item.getId().getAmenityId(),
                        Collectors.mapping(item -> new AssignmentView(
                                item.getId().getRoomTypeId(), item.getQuantity()), Collectors.toList())));
        return page.map(item -> new AmenityView(mapper.toDto(item),
                byAmenity.getOrDefault(item.getId(), List.of())));
    }

    @Transactional
    public AmenityView create(Command command) {
        requireRoomTypes(command.roomTypes());
        Amenity amenity = new Amenity();
        apply(amenity, command);
        Amenity saved = amenities.save(amenity);
        replaceAssignments(saved.getId(), command.roomTypes());
        return view(saved, command.roomTypes());
    }

    @Transactional
    public AmenityView update(UUID id, Command command) {
        requireRoomTypes(command.roomTypes());
        Amenity amenity = active(id);
        apply(amenity, command);
        Amenity saved = amenities.save(amenity);
        replaceAssignments(id, command.roomTypes());
        return view(saved, command.roomTypes());
    }

    @Transactional
    public void delete(UUID id) {
        Amenity amenity = active(id);
        assignments.deleteAllByIdAmenityId(id);
        amenity.setDeletedAt(clock.instant());
        amenities.save(amenity);
    }

    private Amenity active(UUID id) {
        return amenities.findById(id).filter(item -> item.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("Amenity", id));
    }

    private void requireRoomTypes(List<AssignmentCommand> requested) {
        Set<UUID> ids = requested.stream().map(AssignmentCommand::roomTypeId).collect(Collectors.toSet());
        if (ids.size() != requested.size()) {
            throw BusinessException.invalid("Each room type can only be assigned once");
        }
        if (ids.isEmpty()) return;
        Set<UUID> existing = roomTypes.findAllById(ids).stream()
                .filter(item -> item.getDeletedAt() == null)
                .map(item -> item.getId())
                .collect(Collectors.toSet());
        if (!existing.equals(ids)) {
            throw BusinessException.invalid("One or more room types are unavailable");
        }
    }

    private void replaceAssignments(UUID amenityId, List<AssignmentCommand> requested) {
        assignments.deleteAllByIdAmenityId(amenityId);
        assignments.flush();
        List<RoomTypeAmenity> entities = requested.stream().map(item -> {
            RoomTypeAmenity assignment = new RoomTypeAmenity();
            assignment.setId(new RoomTypeAmenityId(item.roomTypeId(), amenityId));
            assignment.setQuantity(item.quantity());
            return assignment;
        }).toList();
        assignments.saveAll(entities);
    }

    private void apply(Amenity amenity, Command command) {
        amenity.setCode(command.code().trim().toUpperCase(Locale.ROOT));
        amenity.setName(command.name().trim());
        amenity.setDescription(blankToNull(command.description()));
        amenity.setIcon(blankToNull(command.icon()));
    }

    private AmenityView view(Amenity amenity, Collection<AssignmentCommand> requested) {
        return new AmenityView(mapper.toDto(amenity), requested.stream()
                .map(item -> new AssignmentView(item.roomTypeId(), item.quantity())).toList());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record Command(String code, String name, String description, String icon,
                          List<AssignmentCommand> roomTypes) {}
    public record AssignmentCommand(UUID roomTypeId, int quantity) {}
    public record AssignmentView(UUID roomTypeId, int quantity) {}
    public record AmenityView(AmenityDto amenity, List<AssignmentView> roomTypes) {}
}
