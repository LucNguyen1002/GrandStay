package com.grandstay.booking.application;

import java.util.List;
import java.util.UUID;

import com.grandstay.booking.infrastructure.BookingGuestRepository;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.booking.infrastructure.BookingRoomRepository;
import com.grandstay.room.infrastructure.RatePlanRepository;
import com.grandstay.room.infrastructure.RoomRepository;
import com.grandstay.room.infrastructure.RoomTypeRepository;
import com.grandstay.shared.domain.ModelEnums.PricingUnit;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.dto.EntityDtos.BookingDto;
import com.grandstay.shared.dto.EntityDtos.BookingGuestDto;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingQueryService {
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository roomRepository;
    private final BookingGuestRepository guestRepository;
    private final RoomRepository physicalRooms;
    private final RoomTypeRepository roomTypes;
    private final RatePlanRepository ratePlans;
    private final EntityMapper mapper;

    public BookingQueryService(BookingRepository bookingRepository, BookingRoomRepository roomRepository,
                               BookingGuestRepository guestRepository, EntityMapper mapper,
                               RoomRepository physicalRooms, RoomTypeRepository roomTypes,
                               RatePlanRepository ratePlans) {
        this.bookingRepository = bookingRepository;
        this.roomRepository = roomRepository;
        this.guestRepository = guestRepository;
        this.mapper = mapper;
        this.physicalRooms = physicalRooms;
        this.roomTypes = roomTypes;
        this.ratePlans = ratePlans;
    }

    @Transactional(readOnly = true)
    public Page<BookingDto> list(BookingStatus status, String search, Pageable pageable) {
        // Keep this parameter textual even when no search term is supplied. PostgreSQL can
        // otherwise infer an untyped null as bytea when Hibernate uses it inside lower(...).
        String normalizedSearch = search == null || search.isBlank() ? "" : search.trim();
        return bookingRepository.search(status, normalizedSearch, pageable).map(mapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<BookingDto> listForCustomer(UUID customerId, BookingStatus status,
                                            String search, Pageable pageable) {
        String normalizedSearch = search == null || search.isBlank() ? "" : search.trim();
        return bookingRepository.searchByCustomerId(customerId, status, normalizedSearch, pageable)
                .map(mapper::toDto);
    }

    @Transactional(readOnly = true)
    public BookingView get(UUID id) {
        BookingDto booking = bookingRepository.findById(id).map(mapper::toDto)
                .orElseThrow(() -> BusinessException.notFound("Booking", id));
        List<BookingRoomView> rooms = roomRepository.findAllByBookingId(id).stream().map(allocation -> {
            var room = physicalRooms.findById(allocation.getRoomId()).orElse(null);
            var roomType = room == null ? null : roomTypes.findById(room.getRoomTypeId()).orElse(null);
            var ratePlan = allocation.getRatePlanId() == null ? null : ratePlans.findById(allocation.getRatePlanId()).orElse(null);
            return new BookingRoomView(allocation.getId(), allocation.getRoomId(), room == null ? null : room.getRoomNumber(),
                    roomType == null ? null : roomType.getCode(), roomType == null ? null : roomType.getName(),
                    allocation.getRatePlanId(), ratePlan == null ? null : ratePlan.getName(), allocation.getPricingUnit(),
                    allocation.getUnitRate(), allocation.getQuantity(), allocation.getRoomCharge());
        }).toList();
        List<BookingGuestDto> guests = guestRepository.findAllByBookingIdOrderByPrimaryDesc(id).stream()
                .map(mapper::toDto).toList();
        return new BookingView(booking, rooms, guests);
    }

    public record BookingRoomView(UUID id, UUID roomId, String roomNumber, String roomTypeCode,
            String roomTypeName, UUID ratePlanId, String ratePlanName, PricingUnit pricingUnit,
            java.math.BigDecimal unitRate, java.math.BigDecimal quantity, java.math.BigDecimal roomCharge) {}
    public record BookingView(BookingDto booking, List<BookingRoomView> rooms,
                              List<BookingGuestDto> guests) {}
}
