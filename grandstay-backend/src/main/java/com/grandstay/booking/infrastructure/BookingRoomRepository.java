package com.grandstay.booking.infrastructure;
import java.util.*; import com.grandstay.booking.domain.BookingRoom; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param;
public interface BookingRoomRepository extends JpaRepository<BookingRoom,UUID> {
 List<BookingRoom> findAllByBookingId(UUID bookingId);
 @Query(value="select exists(select 1 from booking_rooms where room_id=:roomId and allocation_status in ('CONFIRMED','CHECKED_IN') and stay_period && cast(:period as tstzrange) and (:excludedId is null or booking_id<>:excludedId))",nativeQuery=true)
 boolean existsActiveOverlap(@Param("roomId") UUID roomId,@Param("period") String period,@Param("excludedId") UUID excludedBookingId);
}
