package com.grandstay.payment.infrastructure; import java.util.*; import com.grandstay.payment.domain.Payment; import com.grandstay.shared.domain.ModelEnums.PaymentStatus; import jakarta.persistence.LockModeType; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param;
public interface PaymentRepository extends JpaRepository<Payment,UUID> {
 Optional<Payment> findByTransactionCode(String code); List<Payment> findAllByBookingIdAndStatus(UUID bookingId,PaymentStatus status);
 List<Payment> findAllByBookingId(UUID bookingId); List<Payment> findAllByBookingIdOrderByCreatedAtDesc(UUID bookingId);
 List<Payment> findAllByOriginalPaymentIdAndStatus(UUID originalPaymentId,PaymentStatus status);
 Optional<Payment> findByProviderAndProviderOrderId(String provider,String providerOrderId);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from Payment p where p.id=:id") Optional<Payment> findByIdForUpdate(@Param("id") UUID id);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from Payment p where p.provider=:provider and p.providerOrderId=:orderId")
 Optional<Payment> findByProviderAndProviderOrderIdForUpdate(@Param("provider") String provider,@Param("orderId") String orderId);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from Payment p where p.bookingId=:bookingId order by p.createdAt")
 List<Payment> findAllByBookingIdForUpdate(@Param("bookingId") UUID bookingId);
}
