package com.grandstay.room.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.grandstay.room.domain.RoomTypeAmenity;
import com.grandstay.room.domain.RoomTypeAmenityId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomTypeAmenityRepository extends JpaRepository<RoomTypeAmenity, RoomTypeAmenityId> {
    List<RoomTypeAmenity> findAllByIdRoomTypeId(UUID roomTypeId);
    List<RoomTypeAmenity> findAllByIdAmenityIdIn(Collection<UUID> amenityIds);
    void deleteAllByIdAmenityId(UUID amenityId);
}
