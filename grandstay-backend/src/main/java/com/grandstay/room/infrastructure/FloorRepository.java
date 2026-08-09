package com.grandstay.room.infrastructure;

import java.util.UUID;
import com.grandstay.room.domain.Floor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FloorRepository extends JpaRepository<Floor, UUID> {
    Page<Floor> findAllByDeletedAtIsNull(Pageable pageable);
    boolean existsByIdAndDeletedAtIsNull(UUID id);
}
