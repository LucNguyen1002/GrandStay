package com.grandstay.user.infrastructure;

import java.util.UUID;

import com.grandstay.user.domain.UserAvatar;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAvatarRepository extends JpaRepository<UserAvatar, UUID> {
}
