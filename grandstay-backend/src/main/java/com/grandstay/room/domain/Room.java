package com.grandstay.room.domain;
import java.util.UUID; import com.grandstay.shared.domain.*; import com.grandstay.shared.domain.ModelEnums.RoomOperationalStatus;
import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="rooms") @Getter @Setter @NoArgsConstructor
public class Room extends SoftDeletableEntity {
 @Column(name="room_number",nullable=false,unique=true,length=20) private String roomNumber;
 @Column(name="floor_id",nullable=false) private UUID floorId;
 @Column(name="room_type_id",nullable=false) private UUID roomTypeId;
 @Enumerated(EnumType.STRING) @Column(name="operational_status",nullable=false,length=20) private RoomOperationalStatus operationalStatus;
 @Column(length=1000) private String notes;
}
