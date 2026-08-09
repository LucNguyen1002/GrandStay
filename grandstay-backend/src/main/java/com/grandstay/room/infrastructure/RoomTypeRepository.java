package com.grandstay.room.infrastructure;

import java.util.UUID;
import com.grandstay.room.domain.RoomType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomTypeRepository extends JpaRepository<RoomType, UUID> {
    Page<RoomType> findAllByDeletedAtIsNull(Pageable pageable);
    boolean existsByIdAndDeletedAtIsNull(UUID id);
}
