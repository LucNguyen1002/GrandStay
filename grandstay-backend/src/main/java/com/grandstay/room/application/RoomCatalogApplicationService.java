package com.grandstay.room.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.grandstay.room.domain.Floor;
import com.grandstay.room.domain.RatePlan;
import com.grandstay.room.domain.Room;
import com.grandstay.room.domain.RoomType;
import com.grandstay.room.infrastructure.FloorRepository;
import com.grandstay.room.infrastructure.RatePlanRepository;
import com.grandstay.room.infrastructure.RoomRepository;
import com.grandstay.room.infrastructure.RoomTypeRepository;
import com.grandstay.shared.domain.ModelEnums.PricingUnit;
import com.grandstay.shared.domain.ModelEnums.RoomOperationalStatus;
import com.grandstay.shared.dto.EntityDtos.FloorDto;
import com.grandstay.shared.dto.EntityDtos.RatePlanDto;
import com.grandstay.shared.dto.EntityDtos.RoomDto;
import com.grandstay.shared.dto.EntityDtos.RoomTypeDto;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomCatalogApplicationService {
    private final FloorRepository floors;
    private final RoomTypeRepository types;
    private final RoomRepository rooms;
    private final RatePlanRepository rates;
    private final EntityMapper mapper;
    private final Clock clock;

    public RoomCatalogApplicationService(FloorRepository floors, RoomTypeRepository types,
            RoomRepository rooms, RatePlanRepository rates, EntityMapper mapper, Clock clock) {
        this.floors = floors;
        this.types = types;
        this.rooms = rooms;
        this.rates = rates;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<RoomDto> rooms(Pageable pageable) {
        return rooms.findAllByDeletedAtIsNull(pageable).map(mapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<RoomTypeDto> roomTypes(Pageable pageable) {
        return types.findAllByDeletedAtIsNull(pageable).map(mapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<FloorDto> floors(Pageable pageable) {
        return floors.findAllByDeletedAtIsNull(pageable).map(mapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<RatePlanDto> ratePlans(UUID roomTypeId, Pageable pageable) {
        Page<RatePlan> result = roomTypeId == null
                ? rates.findAllByDeletedAtIsNull(pageable)
                : rates.findAllByRoomTypeIdAndDeletedAtIsNull(roomTypeId, pageable);
        return result.map(mapper::toDto);
    }

    @Transactional(readOnly = true)
    public List<RoomMatrixRow> matrix(java.time.Instant at) {
        return rooms.findRoomMatrix(at == null ? clock.instant() : at);
    }

    @Transactional(readOnly = true)
    public List<RoomDto> availableRooms(java.time.Instant from, java.time.Instant to) {
        if (from == null || to == null || !to.isAfter(from)) {
            throw BusinessException.invalid("A valid availability period is required");
        }
        return rooms.findAvailable(from, to).stream().map(mapper::toDto).toList();
    }

    @Transactional
    public FloorDto createFloor(FloorCommand command) {
        Floor floor = new Floor();
        apply(floor, command);
        return mapper.toDto(floors.save(floor));
    }

    @Transactional
    public FloorDto updateFloor(UUID id, FloorCommand command) {
        Floor floor = activeFloor(id);
        apply(floor, command);
        return mapper.toDto(floors.save(floor));
    }

    @Transactional
    public void deleteFloor(UUID id) {
        Floor floor = activeFloor(id);
        if (rooms.existsByFloorIdAndDeletedAtIsNull(id)) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT,
                    "Floor still contains active rooms");
        }
        floor.setDeletedAt(clock.instant());
        floors.save(floor);
    }

    @Transactional
    public RoomTypeDto createType(RoomTypeCommand command) {
        RoomType type = new RoomType();
        apply(type, command);
        return mapper.toDto(types.save(type));
    }

    @Transactional
    public RoomTypeDto updateType(UUID id, RoomTypeCommand command) {
        RoomType type = activeType(id);
        apply(type, command);
        return mapper.toDto(types.save(type));
    }

    @Transactional
    public void deleteType(UUID id) {
        RoomType type = activeType(id);
        if (rooms.existsByRoomTypeIdAndDeletedAtIsNull(id)
                || rates.existsByRoomTypeIdAndDeletedAtIsNull(id)) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT,
                    "Room type still contains active rooms or rate plans");
        }
        type.setDeletedAt(clock.instant());
        types.save(type);
    }

    @Transactional
    public RoomDto createRoom(RoomCommand command) {
        requireCatalog(command.floorId(), command.roomTypeId());
        Room room = new Room();
        apply(room, command);
        return mapper.toDto(rooms.save(room));
    }

    @Transactional
    public RoomDto updateRoom(UUID id, RoomCommand command) {
        requireCatalog(command.floorId(), command.roomTypeId());
        Room room = activeRoom(id);
        apply(room, command);
        return mapper.toDto(rooms.save(room));
    }

    @Transactional
    public void deleteRoom(UUID id) {
        Room room = activeRoom(id);
        if (rooms.hasActiveAllocation(id)) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT,
                    "Room has an active booking and cannot be deleted");
        }
        room.setOperationalStatus(RoomOperationalStatus.OUT_OF_SERVICE);
        room.setDeletedAt(clock.instant());
        rooms.save(room);
    }

    @Transactional
    public RatePlanDto createRate(RatePlanCommand command) {
        requireActiveType(command.roomTypeId());
        RatePlan rate = new RatePlan();
        apply(rate, command);
        return mapper.toDto(rates.save(rate));
    }

    @Transactional
    public RatePlanDto updateRate(UUID id, RatePlanCommand command) {
        requireActiveType(command.roomTypeId());
        RatePlan rate = activeRate(id);
        apply(rate, command);
        return mapper.toDto(rates.save(rate));
    }

    @Transactional
    public void deleteRate(UUID id) {
        RatePlan rate = activeRate(id);
        if (rates.hasActiveAllocation(id)) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT,
                    "Rate plan has an active booking and cannot be deleted");
        }
        rate.setActive(false);
        rate.setDeletedAt(clock.instant());
        rates.save(rate);
    }

    private Floor activeFloor(UUID id) {
        return floors.findById(id).filter(item -> item.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("Floor", id));
    }

    private RoomType activeType(UUID id) {
        return types.findById(id).filter(item -> item.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("Room type", id));
    }

    private Room activeRoom(UUID id) {
        return rooms.findById(id).filter(item -> item.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("Room", id));
    }

    private RatePlan activeRate(UUID id) {
        return rates.findById(id).filter(item -> item.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("Rate plan", id));
    }

    private void requireCatalog(UUID floorId, UUID typeId) {
        if (!floors.existsByIdAndDeletedAtIsNull(floorId)) {
            throw BusinessException.notFound("Floor", floorId);
        }
        requireActiveType(typeId);
    }

    private void requireActiveType(UUID typeId) {
        if (!types.existsByIdAndDeletedAtIsNull(typeId)) {
            throw BusinessException.notFound("Room type", typeId);
        }
    }

    private void apply(Floor floor, FloorCommand command) {
        floor.setCode(command.code().toUpperCase(Locale.ROOT));
        floor.setName(command.name());
        floor.setFloorNumber(command.floorNumber());
        floor.setDescription(command.description());
    }

    private void apply(Room room, RoomCommand command) {
        room.setRoomNumber(command.roomNumber());
        room.setFloorId(command.floorId());
        room.setRoomTypeId(command.roomTypeId());
        room.setOperationalStatus(command.status());
        room.setNotes(command.notes());
    }

    private void apply(RoomType type, RoomTypeCommand command) {
        type.setCode(command.code().toUpperCase(Locale.ROOT));
        type.setName(command.name());
        type.setDescription(command.description());
        type.setCapacityAdults(command.capacityAdults());
        type.setCapacityChildren(command.capacityChildren());
        type.setBaseHourlyRate(command.hourly());
        type.setBaseDailyRate(command.daily());
        type.setBaseNightlyRate(command.nightly());
        type.setCurrency(command.currency().toUpperCase(Locale.ROOT));
    }

    private void apply(RatePlan rate, RatePlanCommand command) {
        rate.setRoomTypeId(command.roomTypeId());
        rate.setCode(command.code().toUpperCase(Locale.ROOT));
        rate.setName(command.name());
        rate.setPricingUnit(command.pricingUnit());
        rate.setRate(command.rate());
        rate.setCurrency(command.currency().toUpperCase(Locale.ROOT));
        rate.setValidFrom(command.validFrom());
        rate.setValidTo(command.validTo());
        rate.setMinStayUnits(command.minStayUnits());
        rate.setRefundable(command.refundable());
        rate.setActive(command.active());
    }

    public record FloorCommand(String code, String name, int floorNumber, String description) {}
    public record RoomCommand(String roomNumber, UUID floorId, UUID roomTypeId,
                              RoomOperationalStatus status, String notes) {}
    public record RoomTypeCommand(String code, String name, String description, int capacityAdults,
                                  int capacityChildren, BigDecimal hourly, BigDecimal daily,
                                  BigDecimal nightly, String currency) {}
    public record RatePlanCommand(UUID roomTypeId, String code, String name, PricingUnit pricingUnit,
                                  BigDecimal rate, String currency, java.time.LocalDate validFrom,
                                  java.time.LocalDate validTo, int minStayUnits,
                                  boolean refundable, boolean active) {}
}
