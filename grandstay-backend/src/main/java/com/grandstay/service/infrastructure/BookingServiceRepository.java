package com.grandstay.service.infrastructure; import java.util.*; import com.grandstay.service.domain.BookingService; import org.springframework.data.jpa.repository.JpaRepository;
public interface BookingServiceRepository extends JpaRepository<BookingService,UUID> { List<BookingService> findAllByBookingIdOrderByServiceAtAsc(UUID bookingId); }
