package com.grandstay.booking.application;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.grandstay.booking.application.BookingCommands.CreateBooking;
import com.grandstay.booking.application.BookingCommands.GuestInput;
import com.grandstay.booking.application.BookingCommands.RoomSelection;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.customer.application.CustomerIdentityService;
import com.grandstay.customer.domain.Customer;
import com.grandstay.shared.domain.ModelEnums.BookingSource;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.dto.EntityDtos.BookingDto;
import com.grandstay.shared.exception.BusinessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SelfBookingApplicationService {
    private final CustomerIdentityService identities;
    private final BookingApplicationService bookings;
    private final BookingQueryService queries;
    private final BookingRepository bookingRepository;

    public SelfBookingApplicationService(CustomerIdentityService identities,
                                         BookingApplicationService bookings,
                                         BookingQueryService queries,
                                         BookingRepository bookingRepository) {
        this.identities = identities;
        this.bookings = bookings;
        this.queries = queries;
        this.bookingRepository = bookingRepository;
    }

    @Transactional
    public Page<BookingDto> list(UUID userId, BookingStatus status, String search, Pageable pageable) {
        Customer customer = identities.resolve(userId);
        return queries.listForCustomer(customer.getId(), status, search, pageable);
    }

    @Transactional
    public BookingQueryService.BookingView get(UUID userId, UUID bookingId) {
        Customer customer = identities.resolve(userId);
        requireOwned(bookingId, customer.getId());
        return queries.get(bookingId);
    }

    @Transactional
    public BookingResult create(UUID userId, CreateSelfBooking command) {
        Customer customer = identities.resolve(userId);
        List<GuestInput> guests = new ArrayList<>();
        guests.add(new GuestInput(customer.getId(), customer.getFullName(), true,
                customer.getNationality(), customer.getDateOfBirth()));
        if (command.guests() != null) {
            command.guests().stream()
                    .filter(guest -> guest != null && !guest.primary())
                    .map(guest -> new GuestInput(null, guest.fullName(), false,
                            guest.nationality(), guest.dateOfBirth()))
                    .forEach(guests::add);
        }
        return bookings.create(new CreateBooking(customer.getId(), command.promotionId(),
                BookingSource.ONLINE, command.expectedCheckInAt(), command.expectedCheckOutAt(),
                command.adults(), command.children(), command.specialRequests(), "VND", true,
                command.rooms(), guests));
    }

    @Transactional
    public void cancel(UUID userId, UUID bookingId, String reason) {
        Customer customer = identities.resolve(userId);
        requireOwned(bookingId, customer.getId());
        bookings.cancel(bookingId, reason);
    }

    private void requireOwned(UUID bookingId, UUID customerId) {
        if (!bookingRepository.existsByIdAndCustomerId(bookingId, customerId)) {
            throw BusinessException.notFound("Booking", bookingId);
        }
    }

    public record CreateSelfBooking(UUID promotionId, Instant expectedCheckInAt,
                                    Instant expectedCheckOutAt, int adults, int children,
                                    String specialRequests, List<RoomSelection> rooms,
                                    List<GuestInput> guests) {}
}
