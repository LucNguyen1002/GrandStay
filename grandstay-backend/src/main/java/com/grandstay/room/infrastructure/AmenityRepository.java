package com.grandstay.room.infrastructure;

import java.util.Optional;
import java.util.UUID;

import com.grandstay.room.domain.Amenity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AmenityRepository extends JpaRepository<Amenity, UUID> {
    Optional<Amenity> findByCodeAndDeletedAtIsNull(String code);
    Page<Amenity> findAllByDeletedAtIsNull(Pageable pageable);
}
