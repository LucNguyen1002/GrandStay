package com.grandstay.user.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_avatars")
@Getter
@Setter
@NoArgsConstructor
public class UserAvatar {
    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "content_type", nullable = false, length = 30)
    private String contentType;

    @Column(name = "image_data", nullable = false, columnDefinition = "bytea")
    private byte[] imageData;

    @Column(name = "file_size", nullable = false)
    private int fileSize;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
