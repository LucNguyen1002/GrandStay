package com.grandstay.booking.application;

import java.util.List;
import java.util.UUID;

import com.grandstay.booking.infrastructure.BookingGuestRepository;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.booking.infrastructure.BookingRoomRepository;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.dto.EntityDtos.BookingDto;
import com.grandstay.shared.dto.EntityDtos.BookingGuestDto;
import com.grandstay.shared.dto.EntityDtos.BookingRoomDto;
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
    private final EntityMapper mapper;

    public BookingQueryService(BookingRepository bookingRepository, BookingRoomRepository roomRepository,
                               BookingGuestRepository guestRepository, EntityMapper mapper) {
        this.bookingRepository = bookingRepository;
        this.roomRepository = roomRepository;
        this.guestRepository = guestRepository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public Page<BookingDto> list(BookingStatus status, String search, Pageable pageable) {
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();
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
        List<BookingRoomDto> rooms = roomRepository.findAllByBookingId(id).stream().map(mapper::toDto).toList();
        List<BookingGuestDto> guests = guestRepository.findAllByBookingIdOrderByPrimaryDesc(id).stream()
                .map(mapper::toDto).toList();
        return new BookingView(booking, rooms, guests);
    }

    public record BookingView(BookingDto booking, List<BookingRoomDto> rooms,
                              List<BookingGuestDto> guests) {}
}
