package com.grandstay.booking.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.grandstay.booking.application.BookingCommands.CreateBooking;
import com.grandstay.booking.application.BookingCommands.GuestInput;
import com.grandstay.booking.application.BookingCommands.RoomSelection;
import com.grandstay.booking.domain.Booking;
import com.grandstay.booking.domain.BookingGuest;
import com.grandstay.booking.domain.BookingRoom;
import com.grandstay.booking.domain.BookingStatusPolicy;
import com.grandstay.booking.domain.PricingService;
import com.grandstay.booking.domain.Promotion;
import com.grandstay.booking.infrastructure.BookingGuestRepository;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.booking.infrastructure.BookingRoomRepository;
import com.grandstay.booking.infrastructure.PromotionRepository;
import com.grandstay.room.domain.RatePlan;
import com.grandstay.room.domain.Room;
import com.grandstay.room.domain.RoomType;
import com.grandstay.room.infrastructure.RatePlanRepository;
import com.grandstay.room.infrastructure.RoomRepository;
import com.grandstay.room.infrastructure.RoomTypeRepository;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.domain.ModelEnums.DiscountType;
import com.grandstay.shared.domain.ModelEnums.RoomOperationalStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingApplicationService {
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final BookingGuestRepository bookingGuestRepository;
    private final RoomRepository roomRepository;
    private final RatePlanRepository ratePlanRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final PromotionRepository promotionRepository;
    private final PricingService pricingService;
    private final BookingStatusPolicy statusPolicy;
    private final Clock clock;
    private final EntityManager entityManager;

    public BookingApplicationService(BookingRepository bookingRepository,
                                     BookingRoomRepository bookingRoomRepository,
                                     BookingGuestRepository bookingGuestRepository,
                                     RoomRepository roomRepository,
                                     RatePlanRepository ratePlanRepository,
                                     RoomTypeRepository roomTypeRepository,
                                     PromotionRepository promotionRepository,
                                     PricingService pricingService,
                                     BookingStatusPolicy statusPolicy,
                                     Clock clock,
                                     EntityManager entityManager) {
        this.bookingRepository = bookingRepository;
        this.bookingRoomRepository = bookingRoomRepository;
        this.bookingGuestRepository = bookingGuestRepository;
        this.roomRepository = roomRepository;
        this.ratePlanRepository = ratePlanRepository;
        this.roomTypeRepository = roomTypeRepository;
        this.promotionRepository = promotionRepository;
        this.pricingService = pricingService;
        this.statusPolicy = statusPolicy;
        this.clock = clock;
        this.entityManager = entityManager;
    }

    @Transactional
    public BookingResult create(CreateBooking command) {
        validate(command);
        String currency = command.currency().toUpperCase(Locale.ROOT);
        String period = period(command.expectedCheckInAt(), command.expectedCheckOutAt());
        Map<UUID, Room> rooms = loadRooms(command.rooms());
        List<RoomDraft> drafts = new ArrayList<>();
        BigDecimal roomTotal = BigDecimal.ZERO;

        for (RoomSelection selection : command.rooms()) {
            Room room = rooms.get(selection.roomId());
            requireBookable(room);
            RoomType roomType = roomTypeRepository.findById(room.getRoomTypeId())
                    .orElseThrow(() -> BusinessException.notFound("Room type", room.getRoomTypeId()));
            if (selection.adults() > roomType.getCapacityAdults()
                    || selection.children() > roomType.getCapacityChildren()) {
                throw BusinessException.invalid("Guest count exceeds capacity of room " + room.getRoomNumber());
            }
            RatePlan ratePlan = ratePlanRepository.findById(selection.ratePlanId())
                    .orElseThrow(() -> BusinessException.notFound("Rate plan", selection.ratePlanId()));
            validateRatePlan(ratePlan, room, command, currency);
            if (command.confirmImmediately()
                    && bookingRoomRepository.existsActiveOverlap(room.getId(), period, null)) {
                throw BusinessException.conflict(ErrorCode.ROOM_NOT_AVAILABLE,
                        "Room " + room.getRoomNumber() + " is not available for the selected period");
            }
            PricingService.Price price = pricingService.calculateRoomCharge(command.expectedCheckInAt(),
                    command.expectedCheckOutAt(), ratePlan.getPricingUnit(), ratePlan.getRate());
            if (price.quantity().compareTo(BigDecimal.valueOf(ratePlan.getMinStayUnits())) < 0) {
                throw BusinessException.conflict(ErrorCode.RATE_PLAN_NOT_AVAILABLE,
                        "Minimum stay for rate plan is " + ratePlan.getMinStayUnits() + " " + ratePlan.getPricingUnit());
            }
            drafts.add(new RoomDraft(room, ratePlan, selection, price));
            roomTotal = roomTotal.add(price.amount());
        }
        roomTotal = pricingService.money(roomTotal);
        BigDecimal discount = applyPromotion(command.promotionId(), roomTotal);

        Booking booking = new Booking();
        booking.setCustomerId(command.customerId());
        booking.setPromotionId(command.promotionId());
        booking.setBookingSource(command.source());
        booking.setStatus(BookingStatus.PENDING);
        booking.setExpectedCheckInAt(command.expectedCheckInAt());
        booking.setExpectedCheckOutAt(command.expectedCheckOutAt());
        booking.setAdults(command.adults());
        booking.setChildren(command.children());
        booking.setSpecialRequests(command.specialRequests());
        booking.setCurrency(currency);
        booking.setDiscountAmount(discount);
        booking.setTaxRate(BigDecimal.ZERO.setScale(4));
        bookingRepository.saveAndFlush(booking);
        entityManager.refresh(booking);

        List<BookingRoom> allocations = drafts.stream().map(draft -> toAllocation(booking, draft, period)).toList();
        bookingRoomRepository.saveAllAndFlush(allocations);
        bookingGuestRepository.saveAll(toGuests(booking.getId(), command.guests()));

        if (command.confirmImmediately()) {
            booking.setStatus(BookingStatus.CONFIRMED);
            bookingRepository.saveAndFlush(booking);
        }
        return result(booking, allocations, roomTotal);
    }

    @Transactional
    public BookingResult confirm(UUID bookingId) {
        Booking booking = lockedBooking(bookingId);
        statusPolicy.requireTransition(booking.getStatus(), BookingStatus.CONFIRMED);
        List<BookingRoom> rooms = bookingRoomRepository.findAllByBookingId(bookingId);
        if (rooms.isEmpty()) throw BusinessException.invalid("Booking must contain at least one room");
        for (BookingRoom allocation : rooms) {
            Room room = roomRepository.findById(allocation.getRoomId())
                    .orElseThrow(() -> BusinessException.notFound("Room", allocation.getRoomId()));
            requireBookable(room);
            if (bookingRoomRepository.existsActiveOverlap(room.getId(), allocation.getStayPeriod(), bookingId)) {
                throw BusinessException.conflict(ErrorCode.ROOM_NOT_AVAILABLE,
                        "Room " + room.getRoomNumber() + " is no longer available");
            }
        }
        booking.setStatus(BookingStatus.CONFIRMED);
        bookingRepository.saveAndFlush(booking);
        return result(booking, rooms, totalRoomCharge(rooms));
    }

    @Transactional
    public void cancel(UUID bookingId, String reason) {
        if (reason == null || reason.isBlank()) throw BusinessException.invalid("Cancellation reason is required");
        Booking booking = lockedBooking(bookingId);
        statusPolicy.requireTransition(booking.getStatus(), BookingStatus.CANCELLED);
        booking.setCancellationReason(reason.trim());
        booking.setStatus(BookingStatus.CANCELLED);
        bookingRepository.saveAndFlush(booking);
    }

    @Transactional
    public void markNoShow(UUID bookingId) {
        Booking booking = lockedBooking(bookingId);
        statusPolicy.requireTransition(booking.getStatus(), BookingStatus.NO_SHOW);
        if (clock.instant().isBefore(booking.getExpectedCheckInAt())) {
            throw new BusinessException(ErrorCode.INVALID_STATE_TRANSITION, HttpStatus.CONFLICT,
                    "Booking cannot be marked no-show before expected check-in");
        }
        booking.setStatus(BookingStatus.NO_SHOW);
        bookingRepository.saveAndFlush(booking);
    }

    Booking lockedBooking(UUID id) {
        return bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> BusinessException.notFound("Booking", id));
    }

    private void validate(CreateBooking command) {
        if (command == null) throw BusinessException.invalid("Booking command is required");
        pricingService.validatePeriod(command.expectedCheckInAt(), command.expectedCheckOutAt());
        if (command.source() == null) throw BusinessException.invalid("Booking source is required");
        if (command.adults() < 1 || command.children() < 0) throw BusinessException.invalid("Invalid guest counts");
        if (command.currency() == null || !command.currency().matches("[A-Za-z]{3}")) {
            throw BusinessException.invalid("Currency must be a three-letter ISO code");
        }
        if (command.rooms().isEmpty()) throw BusinessException.invalid("At least one room is required");
        Set<UUID> uniqueRooms = new HashSet<>();
        int allocatedAdults = 0;
        int allocatedChildren = 0;
        for (RoomSelection room : command.rooms()) {
            if (room.roomId() == null || room.ratePlanId() == null || room.adults() < 1 || room.children() < 0) {
                throw BusinessException.invalid("Every room selection must have valid room, rate plan and guests");
            }
            if (!uniqueRooms.add(room.roomId())) throw BusinessException.invalid("A room cannot be selected twice");
            allocatedAdults += room.adults();
            allocatedChildren += room.children();
        }
        if (allocatedAdults != command.adults() || allocatedChildren != command.children()) {
            throw BusinessException.invalid("Booking guest totals must match room allocations");
        }
        if (command.guests().isEmpty() || command.guests().stream().filter(GuestInput::primary).count() != 1) {
            throw BusinessException.invalid("Exactly one primary guest is required");
        }
        if (command.guests().stream().anyMatch(g -> g.fullName() == null || g.fullName().isBlank())) {
            throw BusinessException.invalid("Every guest must have a full name");
        }
    }

    private Map<UUID, Room> loadRooms(List<RoomSelection> selections) {
        Map<UUID, Room> found = new HashMap<>();
        roomRepository.findAllById(selections.stream().map(RoomSelection::roomId).toList())
                .forEach(room -> found.put(room.getId(), room));
        if (found.size() != selections.size()) throw BusinessException.notFound("One or more rooms", "selection");
        return found;
    }

    private void requireBookable(Room room) {
        if (room.getDeletedAt() != null || room.getOperationalStatus() == RoomOperationalStatus.MAINTENANCE
                || room.getOperationalStatus() == RoomOperationalStatus.OUT_OF_SERVICE) {
            throw BusinessException.conflict(ErrorCode.ROOM_NOT_OPERATIONAL,
                    "Room " + room.getRoomNumber() + " is not operational");
        }
    }

    private void validateRatePlan(RatePlan plan, Room room, CreateBooking command, String currency) {
        LocalDate date = command.expectedCheckInAt().atZone(PricingService.HOTEL_ZONE).toLocalDate();
        boolean inPeriod = (plan.getValidFrom() == null || !date.isBefore(plan.getValidFrom()))
                && (plan.getValidTo() == null || !date.isAfter(plan.getValidTo()));
        if (plan.getDeletedAt() != null || !plan.isActive() || !plan.getRoomTypeId().equals(room.getRoomTypeId())
                || !plan.getCurrency().equalsIgnoreCase(currency) || !inPeriod) {
            throw BusinessException.conflict(ErrorCode.RATE_PLAN_NOT_AVAILABLE,
                    "Rate plan is not available for room " + room.getRoomNumber());
        }
    }

    private BigDecimal applyPromotion(UUID promotionId, BigDecimal subtotal) {
        if (promotionId == null) return BigDecimal.ZERO.setScale(2);
        Promotion promotion = promotionRepository.findByIdForUpdate(promotionId)
                .orElseThrow(() -> BusinessException.notFound("Promotion", promotionId));
        var now = clock.instant();
        boolean unavailable = promotion.getDeletedAt() != null || !promotion.isActive()
                || now.isBefore(promotion.getValidFrom()) || now.isAfter(promotion.getValidTo())
                || subtotal.compareTo(promotion.getMinimumBookingAmount()) < 0
                || (promotion.getUsageLimit() != null && promotion.getUsedCount() >= promotion.getUsageLimit());
        if (unavailable) throw BusinessException.conflict(ErrorCode.PROMOTION_NOT_AVAILABLE,
                "Promotion is not available for this booking");
        BigDecimal discount = promotion.getDiscountType() == DiscountType.PERCENTAGE
                ? pricingService.percentage(subtotal, promotion.getDiscountValue())
                : promotion.getDiscountValue();
        if (promotion.getMaximumDiscount() != null) discount = discount.min(promotion.getMaximumDiscount());
        discount = pricingService.money(discount.min(subtotal));
        promotion.setUsedCount(promotion.getUsedCount() + 1);
        promotionRepository.save(promotion);
        return discount;
    }

    private BookingRoom toAllocation(Booking booking, RoomDraft draft, String period) {
        BookingRoom allocation = new BookingRoom();
        allocation.setBookingId(booking.getId()); allocation.setRoomId(draft.room().getId());
        allocation.setRatePlanId(draft.plan().getId()); allocation.setStayPeriod(period);
        allocation.setPricingUnit(draft.plan().getPricingUnit()); allocation.setUnitRate(draft.plan().getRate());
        allocation.setQuantity(draft.price().quantity()); allocation.setRoomCharge(draft.price().amount());
        allocation.setTaxRate(booking.getTaxRate()); allocation.setAdults(draft.selection().adults());
        allocation.setChildren(draft.selection().children());
        return allocation;
    }

    private List<BookingGuest> toGuests(UUID bookingId, List<GuestInput> inputs) {
        return inputs.stream().map(input -> {
            BookingGuest guest = new BookingGuest();
            guest.setBookingId(bookingId); guest.setCustomerId(input.customerId());
            guest.setFullName(input.fullName().trim()); guest.setPrimary(input.primary());
            guest.setNationality(input.nationality()); guest.setDateOfBirth(input.dateOfBirth());
            return guest;
        }).toList();
    }

    private BookingResult result(Booking booking, List<BookingRoom> rooms, BigDecimal roomTotal) {
        List<BookingResult.AllocatedRoom> allocated = rooms.stream()
                .map(room -> new BookingResult.AllocatedRoom(room.getId(), room.getRoomId(), room.getQuantity(),
                        room.getUnitRate(), room.getRoomCharge())).toList();
        return new BookingResult(booking.getId(), booking.getBookingNumber(), booking.getStatus(),
                booking.getExpectedCheckInAt(), booking.getExpectedCheckOutAt(), roomTotal,
                booking.getDiscountAmount(), booking.getCurrency(), allocated);
    }

    private BigDecimal totalRoomCharge(List<BookingRoom> rooms) {
        return pricingService.money(rooms.stream().map(BookingRoom::getRoomCharge)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private String period(java.time.Instant from, java.time.Instant to) {
        return "[" + DateTimeFormatter.ISO_INSTANT.format(from) + ","
                + DateTimeFormatter.ISO_INSTANT.format(to) + ")";
    }

    private record RoomDraft(Room room, RatePlan plan, RoomSelection selection, PricingService.Price price) {}
}
