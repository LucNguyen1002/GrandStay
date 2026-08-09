package com.grandstay.booking.domain;
import java.math.BigDecimal; import java.time.Instant; import java.util.UUID;
import com.grandstay.shared.domain.BaseEntity; import com.grandstay.shared.domain.ModelEnums.*; import com.grandstay.shared.infrastructure.persistence.PostgresTstzRangeType;
import jakarta.persistence.*; import lombok.*; import org.hibernate.annotations.Type;
@Entity @Table(name="booking_rooms") @Getter @Setter @NoArgsConstructor
public class BookingRoom extends BaseEntity {
 @Column(name="booking_id",nullable=false) private UUID bookingId; @Column(name="room_id",nullable=false) private UUID roomId;
 @Column(name="rate_plan_id") private UUID ratePlanId;
 @Type(PostgresTstzRangeType.class) @Column(name="stay_period",nullable=false,columnDefinition="tstzrange") private String stayPeriod;
 @Enumerated(EnumType.STRING) @Column(name="allocation_status",nullable=false,length=20,insertable=false) private BookingStatus allocationStatus;
 @Enumerated(EnumType.STRING) @Column(name="pricing_unit",nullable=false,length=20) private PricingUnit pricingUnit;
 @Column(name="unit_rate",nullable=false,precision=19,scale=2) private BigDecimal unitRate; @Column(nullable=false,precision=12,scale=2) private BigDecimal quantity;
 @Column(name="room_charge",nullable=false,precision=19,scale=2) private BigDecimal roomCharge; @Column(name="tax_rate",nullable=false,precision=7,scale=4) private BigDecimal taxRate;
 @Column(nullable=false) private int adults; @Column(nullable=false) private int children;
 @Column(name="checked_in_at") private Instant checkedInAt; @Column(name="checked_out_at") private Instant checkedOutAt;
}
