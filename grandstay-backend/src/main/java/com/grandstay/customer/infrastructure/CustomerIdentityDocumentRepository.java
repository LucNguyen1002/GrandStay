package com.grandstay.customer.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.grandstay.customer.domain.CustomerIdentityDocument;
import com.grandstay.shared.domain.ModelEnums.IdentityDocumentSide;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerIdentityDocumentRepository extends JpaRepository<CustomerIdentityDocument, UUID> {
    Optional<CustomerIdentityDocument> findByCustomerIdAndSide(UUID customerId, IdentityDocumentSide side);
    List<CustomerIdentityDocument> findAllByCustomerId(UUID customerId);
    long countByCustomerId(UUID customerId);
}
