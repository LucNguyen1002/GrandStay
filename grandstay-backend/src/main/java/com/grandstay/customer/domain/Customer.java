package com.grandstay.customer.domain;

import java.time.LocalDate;

import com.grandstay.shared.domain.ModelEnums.Gender;
import com.grandstay.shared.domain.ModelEnums.IdentityType;
import com.grandstay.shared.domain.ModelEnums;
import com.grandstay.shared.domain.SoftDeletableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity @Table(name="customers") @Getter @Setter @NoArgsConstructor
public class Customer extends SoftDeletableEntity {
    @Column(name="user_id") private java.util.UUID userId;
    @Column(name="customer_code", nullable=false, unique=true, length=30) private String customerCode;
    @Column(name="full_name", nullable=false, length=150) private String fullName;
    @Column(length=254) private String email;
    @Column(length=30) private String phone;
    @Column(length=2) private String nationality;
    @Column(name="date_of_birth") private LocalDate dateOfBirth;
    @Enumerated(EnumType.STRING) @Column(length=20) private Gender gender;
    @Column(length=500) private String address;
    @Enumerated(EnumType.STRING) @Column(name="identity_type", length=20) private IdentityType identityType;
    @Column(name="identity_ciphertext", columnDefinition="text") private String identityCiphertext;
    @Column(name="identity_hash", length=64) private String identityHash;
    @Column(name="identity_last_four", length=4) private String identityLastFour;
    @Enumerated(EnumType.STRING) @Column(name="identity_verification_status", nullable=false, length=20)
    private ModelEnums.IdentityVerificationStatus identityVerificationStatus = ModelEnums.IdentityVerificationStatus.UNVERIFIED;
    @Column(name="identity_verified_at") private java.time.Instant identityVerifiedAt;
    @Column(name="identity_verified_by") private java.util.UUID identityVerifiedBy;
    @Column(name="identity_rejection_reason", length=500) private String identityRejectionReason;
    @Column(length=1000) private String notes;
}
