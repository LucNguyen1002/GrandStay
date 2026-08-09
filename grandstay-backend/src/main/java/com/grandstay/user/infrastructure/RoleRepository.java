package com.grandstay.user.infrastructure;
import java.util.*; import com.grandstay.user.domain.Role; import org.springframework.data.jpa.repository.JpaRepository;
public interface RoleRepository extends JpaRepository<Role,UUID> { Optional<Role> findByCodeAndDeletedAtIsNull(String code); }
