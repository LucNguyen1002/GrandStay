package com.grandstay.booking.domain;
import java.time.LocalDate; import java.util.UUID; import com.grandstay.shared.domain.BaseEntity; import com.grandstay.shared.domain.ModelEnums.IdentityType;
import jakarta.persistence.*; import lombok.*;
@Entity @Table(name="booking_guests") @Getter @Setter @NoArgsConstructor
public class BookingGuest extends BaseEntity {
 @Column(name="booking_id",nullable=false) private UUID bookingId; @Column(name="customer_id") private UUID customerId;
 @Column(name="full_name",nullable=false,length=150) private String fullName; @Column(name="is_primary",nullable=false) private boolean primary;
 @Column(length=2) private String nationality; @Column(name="date_of_birth") private LocalDate dateOfBirth;
 @Enumerated(EnumType.STRING) @Column(name="identity_type",length=20) private IdentityType identityType;
 @Column(name="identity_ciphertext",columnDefinition="text") private String identityCiphertext; @Column(name="identity_hash",length=64) private String identityHash;
}
