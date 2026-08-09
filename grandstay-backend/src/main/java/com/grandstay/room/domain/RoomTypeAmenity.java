package com.grandstay.room.domain;
import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="room_type_amenities") @Getter @Setter @NoArgsConstructor
public class RoomTypeAmenity { @EmbeddedId private RoomTypeAmenityId id; @Column(nullable=false) private int quantity; }
