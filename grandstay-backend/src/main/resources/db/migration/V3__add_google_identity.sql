ALTER TABLE users ADD COLUMN google_subject varchar(255);

CREATE UNIQUE INDEX uq_users_google_subject_active
    ON users (google_subject)
    WHERE google_subject IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN users.google_subject IS 'Stable Google OpenID Connect subject; never use email as the provider identity key.';
