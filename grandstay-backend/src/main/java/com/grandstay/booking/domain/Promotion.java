package com.grandstay.booking.domain;
import java.math.BigDecimal; import java.time.Instant; import com.grandstay.shared.domain.*; import com.grandstay.shared.domain.ModelEnums.DiscountType;
import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="promotions") @Getter @Setter @NoArgsConstructor
public class Promotion extends SoftDeletableEntity {
 @Column(nullable=false,unique=true,length=50) private String code; @Column(nullable=false,length=150) private String name;
 @Column(length=1000) private String description;
 @Enumerated(EnumType.STRING) @Column(name="discount_type",nullable=false,length=20) private DiscountType discountType;
 @Column(name="discount_value",nullable=false,precision=19,scale=2) private BigDecimal discountValue;
 @Column(name="maximum_discount",precision=19,scale=2) private BigDecimal maximumDiscount;
 @Column(name="minimum_booking_amount",nullable=false,precision=19,scale=2) private BigDecimal minimumBookingAmount;
 @Column(name="valid_from",nullable=false) private Instant validFrom; @Column(name="valid_to",nullable=false) private Instant validTo;
 @Column(name="usage_limit") private Integer usageLimit; @Column(name="used_count",nullable=false) private int usedCount;
 @Column(nullable=false) private boolean active;
}
