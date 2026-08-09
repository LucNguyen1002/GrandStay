CREATE TABLE user_avatars (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content_type varchar(30) NOT NULL,
    image_data bytea NOT NULL,
    file_size integer NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_user_avatars_content_type CHECK (content_type IN ('image/jpeg', 'image/png')),
    CONSTRAINT ck_user_avatars_file_size CHECK (file_size > 0 AND file_size <= 2097152),
    CONSTRAINT ck_user_avatars_dimensions CHECK (
        width > 0 AND height > 0 AND width <= 2048 AND height <= 2048
    )
);
