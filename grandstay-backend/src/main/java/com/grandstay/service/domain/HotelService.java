package com.grandstay.service.domain;
import java.math.BigDecimal; import com.grandstay.shared.domain.SoftDeletableEntity; import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="services") @Getter @Setter @NoArgsConstructor
public class HotelService extends SoftDeletableEntity {
 @Column(nullable=false,unique=true,length=50) private String code; @Column(nullable=false,length=150) private String name;
 @Column(nullable=false,length=50) private String category; @Column(length=1000) private String description;
 @Column(nullable=false,length=30) private String unit; @Column(name="unit_price",nullable=false,precision=19,scale=2) private BigDecimal unitPrice;
 @Column(name="tax_rate",nullable=false,precision=7,scale=4) private BigDecimal taxRate; @Column(nullable=false,length=3) private String currency;
 @Column(nullable=false) private boolean active;
}
