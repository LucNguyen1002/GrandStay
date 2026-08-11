package com.grandstay.customer.domain;

import java.util.UUID;

import com.grandstay.shared.domain.BaseEntity;
import com.grandstay.shared.domain.ModelEnums.IdentityDocumentSide;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "customer_identity_documents", uniqueConstraints =
        @UniqueConstraint(name = "uq_customer_identity_document_side", columnNames = {"customer_id", "document_side"}))
@Getter @Setter @NoArgsConstructor
public class CustomerIdentityDocument extends BaseEntity {
    @Column(name = "customer_id", nullable = false) private UUID customerId;
    @Enumerated(EnumType.STRING) @Column(name = "document_side", nullable = false, length = 10)
    private IdentityDocumentSide side;
    @Column(name = "content_type", nullable = false, length = 30) private String contentType;
    @Column(name = "encrypted_content", nullable = false, columnDefinition = "text") private String encryptedContent;
    @Column(name = "content_size", nullable = false) private int contentSize;
    @Column(name = "content_hash", nullable = false, length = 64) private String contentHash;
}
