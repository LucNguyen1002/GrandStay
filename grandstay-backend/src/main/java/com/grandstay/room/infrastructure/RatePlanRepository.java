package com.grandstay.room.infrastructure;

import java.util.*;
import com.grandstay.room.domain.RatePlan;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RatePlanRepository extends JpaRepository<RatePlan, UUID> {
    List<RatePlan> findAllByRoomTypeIdAndActiveTrueAndDeletedAtIsNull(UUID roomTypeId);
    Page<RatePlan> findAllByDeletedAtIsNull(Pageable pageable);
    Page<RatePlan> findAllByRoomTypeIdAndDeletedAtIsNull(UUID roomTypeId, Pageable pageable);
    boolean existsByRoomTypeIdAndDeletedAtIsNull(UUID roomTypeId);

    @Query(value = """
        select exists (
          select 1 from booking_rooms br
          where br.rate_plan_id=:ratePlanId and br.allocation_status in ('PENDING','CONFIRMED','CHECKED_IN')
        )
        """, nativeQuery = true)
    boolean hasActiveAllocation(@Param("ratePlanId") UUID ratePlanId);
}
