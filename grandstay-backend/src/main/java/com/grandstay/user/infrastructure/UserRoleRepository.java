package com.grandstay.user.infrastructure; import java.util.*; import com.grandstay.user.domain.*; import org.springframework.data.jpa.repository.JpaRepository;
public interface UserRoleRepository extends JpaRepository<UserRole,UserRoleId> {
 List<UserRole> findAllByIdUserId(UUID userId);
 @org.springframework.data.jpa.repository.Query(value="select r.code from roles r join user_roles ur on ur.role_id=r.id where ur.user_id=:userId and r.deleted_at is null",nativeQuery=true)
 List<String> findRoleCodesByUserId(@org.springframework.data.repository.query.Param("userId") UUID userId);
}
