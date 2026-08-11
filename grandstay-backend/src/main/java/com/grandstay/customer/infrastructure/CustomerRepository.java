package com.grandstay.customer.infrastructure;
import java.util.*; import com.grandstay.customer.domain.Customer; import org.springframework.data.domain.*; import org.springframework.data.jpa.repository.JpaRepository;
public interface CustomerRepository extends JpaRepository<Customer,UUID> {
 Optional<Customer> findByCustomerCodeAndDeletedAtIsNull(String code);
 Optional<Customer> findByUserIdAndDeletedAtIsNull(UUID userId);
 Optional<Customer> findFirstByEmailIgnoreCaseAndDeletedAtIsNullOrderByCreatedAtAsc(String email);
 Optional<Customer> findByIdentityHashAndDeletedAtIsNull(String identityHash);
 Page<Customer> findByFullNameContainingIgnoreCaseAndDeletedAtIsNull(String name,Pageable pageable);
}
