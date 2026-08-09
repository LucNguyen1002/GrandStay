package com.grandstay.payment.domain;
import java.math.BigDecimal; import java.time.Instant; import java.util.UUID; import com.grandstay.shared.domain.BaseEntity; import com.grandstay.shared.domain.ModelEnums.*;
import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="payments") @Getter @Setter @NoArgsConstructor
public class Payment extends BaseEntity {
 @Column(name="booking_id",nullable=false) private UUID bookingId; @Column(name="original_payment_id") private UUID originalPaymentId;
 @Column(name="transaction_code",nullable=false,unique=true,length=100) private String transactionCode;
 @Enumerated(EnumType.STRING) @Column(name="payment_type",nullable=false,length=20) private PaymentType paymentType;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private PaymentPurpose purpose;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private PaymentMethod method;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private PaymentStatus status;
 @Column(nullable=false,precision=19,scale=2) private BigDecimal amount; @Column(nullable=false,length=3) private String currency;
 @Column(name="paid_at") private Instant paidAt; @Column(name="provider_reference",length=150) private String providerReference;
 @Column(name="provider",length=30) private String provider;
 @Column(name="provider_order_id",length=100) private String providerOrderId;
 @Column(name="provider_request_id",length=100) private String providerRequestId;
 @Column(name="failure_reason",length=500) private String failureReason; @Column(length=500) private String notes;
}
