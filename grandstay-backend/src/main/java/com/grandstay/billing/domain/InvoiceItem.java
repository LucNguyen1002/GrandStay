package com.grandstay.billing.domain;
import java.math.BigDecimal; import java.time.Instant; import java.util.UUID; import com.grandstay.shared.domain.ModelEnums.InvoiceItemType;
import jakarta.persistence.*; import lombok.*; import org.hibernate.annotations.UuidGenerator;
@Entity @Table(name="invoice_items") @Getter @Setter @NoArgsConstructor
public class InvoiceItem {
 @Id @GeneratedValue @UuidGenerator private UUID id; @Column(name="invoice_id",nullable=false) private UUID invoiceId;
 @Enumerated(EnumType.STRING) @Column(name="item_type",nullable=false,length=20) private InvoiceItemType itemType; @Column(name="reference_id") private UUID referenceId;
 @Column(nullable=false,length=500) private String description; @Column(nullable=false,length=30) private String unit;
 @Column(nullable=false,precision=12,scale=2) private BigDecimal quantity; @Column(name="unit_price",nullable=false,precision=19,scale=2) private BigDecimal unitPrice;
 @Column(name="discount_amount",nullable=false,precision=19,scale=2) private BigDecimal discountAmount; @Column(name="tax_rate",nullable=false,precision=7,scale=4) private BigDecimal taxRate;
 @Column(name="tax_amount",nullable=false,precision=19,scale=2) private BigDecimal taxAmount; @Column(name="line_total",nullable=false,precision=19,scale=2) private BigDecimal lineTotal;
 @Column(name="display_order",nullable=false) private int displayOrder; @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
}
