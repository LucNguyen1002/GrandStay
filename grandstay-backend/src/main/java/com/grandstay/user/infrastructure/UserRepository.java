package com.grandstay.user.infrastructure;
import java.util.*; import com.grandstay.user.domain.User; import com.grandstay.shared.domain.ModelEnums.UserStatus; import org.springframework.data.domain.*; import org.springframework.data.jpa.repository.JpaRepository;
public interface UserRepository extends JpaRepository<User,UUID> {
 Optional<User> findByUsernameIgnoreCaseAndDeletedAtIsNull(String username);
 Optional<User> findByEmailIgnoreCaseAndDeletedAtIsNull(String email);
 Optional<User> findByGoogleSubjectAndDeletedAtIsNull(String googleSubject);
 boolean existsByIdAndDeletedAtIsNull(UUID id);
 boolean existsByIdAndStatusAndDeletedAtIsNull(UUID id, UserStatus status);
 boolean existsByUsernameIgnoreCaseAndDeletedAtIsNull(String username);
 boolean existsByEmailIgnoreCaseAndDeletedAtIsNull(String email);
 Page<User> findAllByStatusAndDeletedAtIsNull(UserStatus status, Pageable pageable);
 Page<User> findAllByDeletedAtIsNull(Pageable pageable);
 @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @org.springframework.data.jpa.repository.Query("select u from User u where u.deletedAt is null and (lower(u.username)=lower(:login) or lower(u.email)=lower(:login))")
 Optional<User> findForAuthentication(@org.springframework.data.repository.query.Param("login") String login);
}
