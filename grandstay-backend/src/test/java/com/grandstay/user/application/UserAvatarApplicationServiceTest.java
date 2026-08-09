package com.grandstay.user.application;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import javax.imageio.ImageIO;

import com.grandstay.shared.exception.BusinessException;
import com.grandstay.user.domain.UserAvatar;
import com.grandstay.user.infrastructure.UserAvatarRepository;
import com.grandstay.user.infrastructure.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserAvatarApplicationServiceTest {
    private static final UUID USER_ID = UUID.fromString("7f1415f5-ec18-4d28-8335-87b9f8c55062");
    private static final Instant NOW = Instant.parse("2026-08-07T06:30:00Z");

    @Mock UserRepository users;
    @Mock UserAvatarRepository avatars;
    UserAvatarApplicationService service;

    @BeforeEach
    void setUp() {
        service = new UserAvatarApplicationService(users, avatars, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void storesValidatedPngAndUsesDetectedMetadata() throws Exception {
        when(users.existsByIdAndDeletedAtIsNull(USER_ID)).thenReturn(true);
        when(avatars.findById(USER_ID)).thenReturn(Optional.empty());
        when(avatars.save(any(UserAvatar.class))).thenAnswer(invocation -> invocation.getArgument(0));
        byte[] png = png(32, 24);

        var result = service.update(USER_ID,
                new MockMultipartFile("file", "avatar.png", "application/octet-stream", png));

        assertThat(result.contentType()).isEqualTo("image/png");
        assertThat(result.width()).isEqualTo(32);
        assertThat(result.height()).isEqualTo(24);
        assertThat(result.fileSize()).isEqualTo(png.length);
        assertThat(result.updatedAt()).isEqualTo(NOW);
        assertThat(result.bytes()).isEqualTo(png);
    }

    @Test
    void rejectsContentThatIsNotAnImage() {
        when(users.existsByIdAndDeletedAtIsNull(USER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.update(USER_ID,
                new MockMultipartFile("file", "avatar.png", "image/png", "not-an-image".getBytes())))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getMessage())
                                .isEqualTo("Avatar must be a valid JPEG or PNG image"));
    }

    @Test
    void rejectsFileOverTwoMegabytesBeforeParsing() {
        when(users.existsByIdAndDeletedAtIsNull(USER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.update(USER_ID,
                new MockMultipartFile("file", "large.png", "image/png",
                        new byte[UserAvatarApplicationService.MAX_FILE_SIZE + 1])))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getMessage())
                                .isEqualTo("Avatar image must not exceed 2 MB"));
    }

    private static byte[] png(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }
}
