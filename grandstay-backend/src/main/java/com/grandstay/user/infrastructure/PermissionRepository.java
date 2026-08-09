package com.grandstay.user.infrastructure; import java.util.*; import com.grandstay.user.domain.Permission; import org.springframework.data.jpa.repository.JpaRepository;
public interface PermissionRepository extends JpaRepository<Permission,UUID> { Optional<Permission> findByCode(String code); }
