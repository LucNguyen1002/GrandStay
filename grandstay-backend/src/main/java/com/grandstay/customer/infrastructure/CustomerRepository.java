package com.grandstay.customer.infrastructure;
import java.util.*; import com.grandstay.customer.domain.Customer; import org.springframework.data.domain.*; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param;
public interface CustomerRepository extends JpaRepository<Customer,UUID> {
 Optional<Customer> findByCustomerCodeAndDeletedAtIsNull(String code);
 Optional<Customer> findByUserIdAndDeletedAtIsNull(UUID userId);
 Optional<Customer> findFirstByEmailIgnoreCaseAndDeletedAtIsNullOrderByCreatedAtAsc(String email);
 Optional<Customer> findByIdentityHashAndDeletedAtIsNull(String identityHash);
 Page<Customer> findByFullNameContainingIgnoreCaseAndDeletedAtIsNull(String name,Pageable pageable);
 Page<Customer> findAllByDeletedAtIsNull(Pageable pageable);
 @Query("""
  select c from Customer c where c.deletedAt is null and (
    lower(c.fullName) like concat('%', lower(:search), '%')
    or lower(c.customerCode) like concat('%', lower(:search), '%')
    or lower(coalesce(c.email, '')) like concat('%', lower(:search), '%')
    or lower(coalesce(c.phone, '')) like concat('%', lower(:search), '%'))
  """)
 Page<Customer> searchActive(@Param("search") String search, Pageable pageable);
}
