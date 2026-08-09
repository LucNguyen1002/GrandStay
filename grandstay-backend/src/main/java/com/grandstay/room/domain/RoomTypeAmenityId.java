package com.grandstay.room.domain;
import java.io.Serializable; import java.util.UUID; import jakarta.persistence.*; import lombok.*;
@Embeddable @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
public class RoomTypeAmenityId implements Serializable { @Column(name="room_type_id") private UUID roomTypeId; @Column(name="amenity_id") private UUID amenityId; }
