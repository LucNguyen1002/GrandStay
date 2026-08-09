package com.grandstay.room.domain;
import com.grandstay.shared.domain.SoftDeletableEntity;
import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="floors") @Getter @Setter @NoArgsConstructor
public class Floor extends SoftDeletableEntity {
 @Column(nullable=false,unique=true,length=30) private String code;
 @Column(nullable=false,length=100) private String name;
 @Column(name="floor_number",nullable=false,unique=true) private int floorNumber;
 @Column(length=500) private String description;
}
