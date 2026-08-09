package com.grandstay.room.domain;
import com.grandstay.shared.domain.SoftDeletableEntity; import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="amenities") @Getter @Setter @NoArgsConstructor
public class Amenity extends SoftDeletableEntity {
 @Column(nullable=false,unique=true,length=50) private String code;
 @Column(nullable=false,length=100) private String name;
 @Column(length=500) private String description;
 @Column(length=100) private String icon;
}
