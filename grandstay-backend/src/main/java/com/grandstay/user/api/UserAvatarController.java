package com.grandstay.user.api;

import java.time.Instant;
import java.util.UUID;

import com.grandstay.user.application.UserAvatarApplicationService;
import com.grandstay.user.application.UserAvatarApplicationService.AvatarData;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "User avatar")
public class UserAvatarController {
    private final UserAvatarApplicationService avatars;

    public UserAvatarController(UserAvatarApplicationService avatars) {
        this.avatars = avatars;
    }

    @GetMapping("/{userId}/avatar")
    public ResponseEntity<byte[]> get(@PathVariable UUID userId) {
        AvatarData avatar = avatars.get(userId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatar.contentType()))
                .contentLength(avatar.fileSize())
                .cacheControl(CacheControl.noStore())
                .lastModified(avatar.updatedAt())
                .body(avatar.bytes());
    }

    @PutMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public AvatarResponse update(@AuthenticationPrincipal Jwt jwt,
                                 @RequestPart("file") MultipartFile file) {
        UUID userId = UUID.fromString(jwt.getSubject());
        AvatarData avatar = avatars.update(userId, file);
        return new AvatarResponse("/api/v1/users/" + userId + "/avatar", avatar.updatedAt(),
                avatar.width(), avatar.height());
    }

    @DeleteMapping("/me/avatar")
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt) {
        avatars.delete(UUID.fromString(jwt.getSubject()));
    }

    public record AvatarResponse(String avatarUrl, Instant updatedAt, int width, int height) {
    }
}
