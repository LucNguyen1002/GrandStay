package com.grandstay.user.infrastructure; import java.util.*; import com.grandstay.user.domain.*; import org.springframework.data.jpa.repository.JpaRepository;
public interface RolePermissionRepository extends JpaRepository<RolePermission,RolePermissionId> {
 List<RolePermission> findAllByIdRoleId(UUID roleId);
 @org.springframework.data.jpa.repository.Query(value="select distinct p.code from permissions p join role_permissions rp on rp.permission_id=p.id join user_roles ur on ur.role_id=rp.role_id where ur.user_id=:userId",nativeQuery=true)
 List<String> findPermissionCodesByUserId(@org.springframework.data.repository.query.Param("userId") UUID userId);
}
