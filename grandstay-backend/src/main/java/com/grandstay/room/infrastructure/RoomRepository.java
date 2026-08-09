package com.grandstay.room.infrastructure;
import java.time.Instant; import java.util.*; import com.grandstay.room.application.RoomMatrixRow; import com.grandstay.room.domain.Room; import com.grandstay.shared.domain.ModelEnums.RoomOperationalStatus; import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param;
public interface RoomRepository extends JpaRepository<Room,UUID> {
 Page<Room> findAllByDeletedAtIsNull(Pageable pageable);
 boolean existsByFloorIdAndDeletedAtIsNull(UUID floorId);
 boolean existsByRoomTypeIdAndDeletedAtIsNull(UUID roomTypeId);
 List<Room> findAllByFloorIdAndOperationalStatusAndDeletedAtIsNull(UUID floorId,RoomOperationalStatus status);
 Optional<Room> findByRoomNumberAndDeletedAtIsNull(String number);
 @Query(value="""
  select r.id roomId,r.room_number roomNumber,f.id floorId,f.name floorName,f.floor_number floorNumber,
         rt.id roomTypeId,rt.name roomTypeName,
         case when br.allocation_status='CHECKED_IN' then 'OCCUPIED'
              when br.allocation_status='CONFIRMED' then 'RESERVED' else r.operational_status end displayStatus,
         br.booking_id bookingId
  from rooms r join floors f on f.id=r.floor_id join room_types rt on rt.id=r.room_type_id
  left join lateral (
    select allocation.booking_id,allocation.allocation_status
    from booking_rooms allocation
    where allocation.room_id=r.id
      and (allocation.allocation_status='CHECKED_IN'
        or (allocation.allocation_status='CONFIRMED'
          and cast(:at as timestamptz) <@ allocation.stay_period))
    order by case when allocation.allocation_status='CHECKED_IN' then 0 else 1 end
    limit 1
  ) br on true
  where r.deleted_at is null and f.deleted_at is null order by f.floor_number,r.room_number
  """,nativeQuery=true)
 List<RoomMatrixRow> findRoomMatrix(@Param("at") Instant at);
 @Query(value="""
  select r.* from rooms r
  where r.deleted_at is null and r.operational_status='AVAILABLE'
    and not exists (
      select 1 from booking_rooms br
      where br.room_id=r.id
        and br.allocation_status in ('CONFIRMED','CHECKED_IN')
        and br.stay_period && tstzrange(cast(:from as timestamptz),cast(:to as timestamptz),'[)')
    )
  order by r.room_number
  """,nativeQuery=true)
 List<Room> findAvailable(@Param("from") Instant from,@Param("to") Instant to);
 @Query(value="""
  select exists (
    select 1 from booking_rooms br
    where br.room_id=:roomId and br.allocation_status in ('PENDING','CONFIRMED','CHECKED_IN')
  )
  """,nativeQuery=true)
 boolean hasActiveAllocation(@Param("roomId") UUID roomId);
}
