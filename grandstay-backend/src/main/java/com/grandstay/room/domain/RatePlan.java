package com.grandstay.room.domain;
import java.math.BigDecimal; import java.time.LocalDate; import java.util.UUID;
import com.grandstay.shared.domain.*; import com.grandstay.shared.domain.ModelEnums.PricingUnit; import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="rate_plans") @Getter @Setter @NoArgsConstructor
public class RatePlan extends SoftDeletableEntity {
 @Column(name="room_type_id",nullable=false) private UUID roomTypeId;
 @Column(nullable=false,unique=true,length=50) private String code;
 @Column(nullable=false,length=100) private String name;
 @Enumerated(EnumType.STRING) @Column(name="pricing_unit",nullable=false,length=20) private PricingUnit pricingUnit;
 @Column(nullable=false,precision=19,scale=2) private BigDecimal rate;
 @Column(nullable=false,length=3) private String currency;
 @Column(name="valid_from") private LocalDate validFrom; @Column(name="valid_to") private LocalDate validTo;
 @Column(name="min_stay_units",nullable=false) private int minStayUnits;
 @Column(nullable=false) private boolean refundable; @Column(nullable=false) private boolean active;
}
