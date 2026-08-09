package com.grandstay.user.application;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.Iterator;
import java.util.Locale;
import java.util.UUID;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import com.grandstay.shared.exception.BusinessException;
import com.grandstay.user.domain.UserAvatar;
import com.grandstay.user.infrastructure.UserAvatarRepository;
import com.grandstay.user.infrastructure.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class UserAvatarApplicationService {
    public static final int MAX_FILE_SIZE = 2 * 1024 * 1024;
    public static final int MAX_DIMENSION = 2048;

    private final UserRepository users;
    private final UserAvatarRepository avatars;
    private final Clock clock;

    public UserAvatarApplicationService(UserRepository users, UserAvatarRepository avatars, Clock clock) {
        this.users = users;
        this.avatars = avatars;
        this.clock = clock;
    }

    @Transactional
    public AvatarData update(UUID userId, MultipartFile file) {
        requireUser(userId);
        if (file == null || file.isEmpty()) {
            throw BusinessException.invalid("Avatar image is required");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw BusinessException.invalid("Avatar image must not exceed 2 MB");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw BusinessException.invalid("Avatar image could not be read");
        }
        if (bytes.length > MAX_FILE_SIZE) {
            throw BusinessException.invalid("Avatar image must not exceed 2 MB");
        }
        ImageMetadata metadata = inspect(bytes);

        UserAvatar avatar = avatars.findById(userId).orElseGet(UserAvatar::new);
        avatar.setUserId(userId);
        avatar.setContentType(metadata.contentType());
        avatar.setImageData(bytes);
        avatar.setFileSize(bytes.length);
        avatar.setWidth(metadata.width());
        avatar.setHeight(metadata.height());
        avatar.setUpdatedAt(clock.instant());
        return toData(avatars.save(avatar));
    }

    @Transactional(readOnly = true)
    public AvatarData get(UUID userId) {
        UserAvatar avatar = avatars.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("User avatar", userId));
        return toData(avatar);
    }

    @Transactional
    public void delete(UUID userId) {
        requireUser(userId);
        avatars.deleteById(userId);
    }

    private void requireUser(UUID userId) {
        if (!users.existsByIdAndDeletedAtIsNull(userId)) {
            throw BusinessException.notFound("User", userId);
        }
    }

    private static ImageMetadata inspect(byte[] bytes) {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (input == null) throw BusinessException.invalid("Avatar must be a valid JPEG or PNG image");
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw BusinessException.invalid("Avatar must be a valid JPEG or PNG image");

            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                String contentType = switch (format) {
                    case "jpg", "jpeg" -> "image/jpeg";
                    case "png" -> "image/png";
                    default -> throw BusinessException.invalid("Avatar must be a JPEG or PNG image");
                };
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    throw BusinessException.invalid("Avatar dimensions must not exceed 2048 x 2048 pixels");
                }
                reader.read(0);
                return new ImageMetadata(contentType, width, height);
            } finally {
                reader.dispose();
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw BusinessException.invalid("Avatar must be a valid JPEG or PNG image");
        }
    }

    private static AvatarData toData(UserAvatar avatar) {
        return new AvatarData(avatar.getImageData(), avatar.getContentType(), avatar.getFileSize(),
                avatar.getWidth(), avatar.getHeight(), avatar.getUpdatedAt());
    }

    private record ImageMetadata(String contentType, int width, int height) {
    }

    public record AvatarData(byte[] bytes, String contentType, int fileSize, int width, int height,
                             Instant updatedAt) {
    }
}
