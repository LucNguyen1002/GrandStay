package com.grandstay.booking.infrastructure; import java.util.*; import com.grandstay.booking.domain.BookingGuest; import org.springframework.data.jpa.repository.JpaRepository;
public interface BookingGuestRepository extends JpaRepository<BookingGuest,UUID> { List<BookingGuest> findAllByBookingIdOrderByPrimaryDesc(UUID bookingId); }
