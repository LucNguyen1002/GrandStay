package com.grandstay.room.domain;
import java.math.BigDecimal; import com.grandstay.shared.domain.SoftDeletableEntity;
import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="room_types") @Getter @Setter @NoArgsConstructor
public class RoomType extends SoftDeletableEntity {
 @Column(nullable=false,unique=true,length=30) private String code;
 @Column(nullable=false,length=100) private String name;
 @Column(length=1000) private String description;
 @Column(name="capacity_adults",nullable=false) private int capacityAdults;
 @Column(name="capacity_children",nullable=false) private int capacityChildren;
 @Column(name="base_hourly_rate",precision=19,scale=2) private BigDecimal baseHourlyRate;
 @Column(name="base_daily_rate",precision=19,scale=2) private BigDecimal baseDailyRate;
 @Column(name="base_nightly_rate",nullable=false,precision=19,scale=2) private BigDecimal baseNightlyRate;
 @Column(nullable=false,length=3) private String currency;
}
