ALTER TABLE customers
    ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_customers_active_user
    ON customers(user_id)
    WHERE user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_customers_email
    ON customers(lower(email))
    WHERE email IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN customers.user_id IS
    'Links a login account to its customer profile for ownership-scoped self-service.';
