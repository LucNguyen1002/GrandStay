package com.grandstay.booking.infrastructure;
import java.time.Instant; import java.util.*; import com.grandstay.booking.domain.Booking; import com.grandstay.shared.domain.ModelEnums.BookingStatus; import jakarta.persistence.LockModeType; import org.springframework.data.domain.*; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param;
public interface BookingRepository extends JpaRepository<Booking,UUID> {
 Optional<Booking> findByBookingNumber(String number);
 Page<Booking> findAllByStatus(BookingStatus status,Pageable pageable);
 @Query(value="""
  select distinct b from Booking b left join BookingGuest g on g.bookingId=b.id
  where (:status is null or b.status=:status)
    and (lower(b.bookingNumber) like concat('%',lower(:search),'%')
         or lower(g.fullName) like concat('%',lower(:search),'%'))
  """,countQuery="""
  select count(distinct b.id) from Booking b left join BookingGuest g on g.bookingId=b.id
  where (:status is null or b.status=:status)
    and (lower(b.bookingNumber) like concat('%',lower(:search),'%')
         or lower(g.fullName) like concat('%',lower(:search),'%'))
  """)
 Page<Booking> search(@Param("status") BookingStatus status,@Param("search") String search,Pageable pageable);
 @Query(value="""
  select distinct b from Booking b left join BookingGuest g on g.bookingId=b.id
  where b.customerId=:customerId
    and (:status is null or b.status=:status)
    and (lower(b.bookingNumber) like concat('%',lower(:search),'%')
         or lower(g.fullName) like concat('%',lower(:search),'%'))
  """,countQuery="""
  select count(distinct b.id) from Booking b left join BookingGuest g on g.bookingId=b.id
  where b.customerId=:customerId
    and (:status is null or b.status=:status)
    and (lower(b.bookingNumber) like concat('%',lower(:search),'%')
         or lower(g.fullName) like concat('%',lower(:search),'%'))
  """)
 Page<Booking> searchByCustomerId(@Param("customerId") UUID customerId,
                                  @Param("status") BookingStatus status,
                                  @Param("search") String search,
                                  Pageable pageable);
 boolean existsByIdAndCustomerId(UUID id, UUID customerId);
 @Query("select b from Booking b where b.expectedCheckInAt < :to and b.expectedCheckOutAt > :from and b.status in :statuses")
 List<Booking> findOverlapping(@Param("from") Instant from,@Param("to") Instant to,@Param("statuses") Collection<BookingStatus> statuses);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select b from Booking b where b.id=:id")
 Optional<Booking> findByIdForUpdate(@Param("id") UUID id);
}
