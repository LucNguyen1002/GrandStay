package com.grandstay.auth.infrastructure;
import java.time.Instant; import java.util.*; import com.grandstay.auth.domain.RefreshToken; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param;
public interface RefreshTokenRepository extends JpaRepository<RefreshToken,UUID> {
 Optional<RefreshToken> findByTokenHash(String tokenHash);
 List<RefreshToken> findAllByUserIdOrderByCreatedAtAsc(UUID userId);
 boolean existsByUserIdAndFamilyId(UUID userId,UUID familyId);
 @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @Query("select t from RefreshToken t where t.tokenHash=:tokenHash")
 Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);
 @Modifying @Query("update RefreshToken t set t.revokedAt=:now,t.revokeReason=:reason where t.familyId=:familyId and t.revokedAt is null")
 int revokeFamily(@Param("familyId") UUID familyId,@Param("now") Instant now,@Param("reason") String reason);
 @Modifying @Query("update RefreshToken t set t.revokedAt=:now,t.revokeReason=:reason where t.userId=:userId and t.revokedAt is null")
 int revokeAllForUser(@Param("userId") UUID userId,@Param("now") Instant now,@Param("reason") String reason);
}
