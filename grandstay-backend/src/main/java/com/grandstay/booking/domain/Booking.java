package com.grandstay.booking.domain;
import java.math.BigDecimal; import java.time.Instant; import java.util.UUID;
import com.grandstay.shared.domain.BaseEntity; import com.grandstay.shared.domain.ModelEnums.*; import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="bookings") @Getter @Setter @NoArgsConstructor
public class Booking extends BaseEntity {
 @Column(name="booking_number",nullable=false,unique=true,length=30,insertable=false,updatable=false) private String bookingNumber;
 @Column(name="customer_id") private UUID customerId; @Column(name="promotion_id") private UUID promotionId;
 @Enumerated(EnumType.STRING) @Column(name="booking_source",nullable=false,length=20) private BookingSource bookingSource;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private BookingStatus status;
 @Column(name="expected_check_in_at",nullable=false) private Instant expectedCheckInAt; @Column(name="expected_check_out_at",nullable=false) private Instant expectedCheckOutAt;
 @Column(name="actual_check_in_at") private Instant actualCheckInAt; @Column(name="actual_check_out_at") private Instant actualCheckOutAt;
 @Column(nullable=false) private int adults; @Column(nullable=false) private int children;
 @Column(name="special_requests",length=2000) private String specialRequests; @Column(nullable=false,length=3) private String currency;
 @Column(name="discount_amount",nullable=false,precision=19,scale=2) private BigDecimal discountAmount;
 @Column(name="tax_rate",nullable=false,precision=7,scale=4) private BigDecimal taxRate;
 @Column(name="cancellation_reason",length=1000) private String cancellationReason;
}
