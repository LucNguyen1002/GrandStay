package com.grandstay.service.domain;
import java.math.BigDecimal; import java.time.Instant; import java.util.UUID; import com.grandstay.shared.domain.BaseEntity; import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="booking_services") @Getter @Setter @NoArgsConstructor
public class BookingService extends BaseEntity {
 @Column(name="booking_id",nullable=false) private UUID bookingId; @Column(name="booking_room_id") private UUID bookingRoomId; @Column(name="service_id",nullable=false) private UUID serviceId;
 @Column(name="service_name",nullable=false,length=150) private String serviceName; @Column(nullable=false,length=30) private String unit;
 @Column(name="unit_price",nullable=false,precision=19,scale=2) private BigDecimal unitPrice; @Column(nullable=false,precision=12,scale=2) private BigDecimal quantity;
 @Column(name="tax_rate",nullable=false,precision=7,scale=4) private BigDecimal taxRate; @Column(name="service_at",nullable=false) private Instant serviceAt;
 @Column(length=500) private String notes;
}
