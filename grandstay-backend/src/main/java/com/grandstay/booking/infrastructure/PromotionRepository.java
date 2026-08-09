package com.grandstay.booking.infrastructure;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.booking.domain.Promotion;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {
    Optional<Promotion> findByCodeAndActiveTrueAndValidFromLessThanEqualAndValidToGreaterThanEqualAndDeletedAtIsNull(
            String code, Instant nowFrom, Instant nowTo);

    Page<Promotion> findAllByDeletedAtIsNull(Pageable pageable);

    @Query("""
            select p from Promotion p
            where p.deletedAt is null and p.active = true
              and p.validFrom <= :now and p.validTo >= :now
              and (p.usageLimit is null or p.usedCount < p.usageLimit)
            """)
    Page<Promotion> findAvailable(@Param("now") Instant now, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Promotion p where p.id=:id")
    Optional<Promotion> findByIdForUpdate(@Param("id") UUID id);
}
