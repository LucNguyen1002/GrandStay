package com.grandstay.billing.domain;
import java.math.BigDecimal; import java.time.Instant; import java.util.UUID; import com.grandstay.shared.domain.BaseEntity; import com.grandstay.shared.domain.ModelEnums.InvoiceStatus;
import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="invoices") @Getter @Setter @NoArgsConstructor
public class Invoice extends BaseEntity {
 @Column(name="invoice_number",nullable=false,unique=true,length=30,insertable=false,updatable=false) private String invoiceNumber;
 @Column(name="booking_id",nullable=false) private UUID bookingId; @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private InvoiceStatus status;
 @Column(name="issued_at") private Instant issuedAt; @Column(name="due_at") private Instant dueAt;
 @Column(name="customer_name",nullable=false,length=150) private String customerName; @Column(name="customer_tax_code",length=50) private String customerTaxCode;
 @Column(name="billing_address",length=500) private String billingAddress; @Column(nullable=false,length=3) private String currency;
 @Column(name="room_charge",nullable=false,precision=19,scale=2) private BigDecimal roomCharge;
 @Column(name="service_charge",nullable=false,precision=19,scale=2) private BigDecimal serviceCharge;
 @Column(name="extra_fee",nullable=false,precision=19,scale=2) private BigDecimal extraFee;
 @Column(name="discount_amount",nullable=false,precision=19,scale=2) private BigDecimal discountAmount;
 @Column(name="tax_amount",nullable=false,precision=19,scale=2) private BigDecimal taxAmount;
 @Column(name="grand_total",nullable=false,precision=19,scale=2) private BigDecimal grandTotal; @Column(length=1000) private String notes;
}
