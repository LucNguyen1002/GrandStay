ALTER TABLE customers
    ADD COLUMN identity_last_four varchar(4),
    ADD COLUMN identity_verification_status varchar(20) NOT NULL DEFAULT 'UNVERIFIED',
    ADD COLUMN identity_verified_at timestamptz,
    ADD COLUMN identity_verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN identity_rejection_reason varchar(500);

ALTER TABLE customers
    ADD CONSTRAINT ck_customers_identity_verification_status
        CHECK (identity_verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
    ADD CONSTRAINT ck_customers_identity_last_four
        CHECK (identity_last_four IS NULL OR length(identity_last_four) BETWEEN 2 AND 4),
    ADD CONSTRAINT ck_customers_identity_verified_pair
        CHECK ((identity_verification_status = 'VERIFIED') = (identity_verified_at IS NOT NULL));

CREATE TABLE customer_identity_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    document_side varchar(10) NOT NULL,
    content_type varchar(30) NOT NULL,
    encrypted_content text NOT NULL,
    content_size integer NOT NULL,
    content_hash varchar(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    CONSTRAINT uq_customer_identity_document_side UNIQUE (customer_id, document_side),
    CONSTRAINT ck_customer_identity_document_side CHECK (document_side IN ('FRONT', 'BACK')),
    CONSTRAINT ck_customer_identity_document_type CHECK (content_type IN ('image/jpeg', 'image/png')),
    CONSTRAINT ck_customer_identity_document_size CHECK (content_size > 0 AND content_size <= 2097152)
);

CREATE INDEX idx_customer_identity_documents_customer ON customer_identity_documents(customer_id);
CREATE TRIGGER trg_customer_identity_documents_updated_at
BEFORE UPDATE ON customer_identity_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN customer_identity_documents.encrypted_content IS
    'AES-GCM encrypted identity image; never expose as a public URL or write it to logs.';

-- Practical starter rates for a small or medium Vietnamese hotel. Existing custom
-- rate plans are left untouched; only the known bootstrap catalog is adjusted.
UPDATE room_types SET
    base_hourly_rate = CASE code WHEN 'STD' THEN 90000 WHEN 'SUP' THEN 110000 WHEN 'DLX' THEN 140000 WHEN 'FAM' THEN 170000 ELSE base_hourly_rate END,
    base_daily_rate = CASE code WHEN 'STD' THEN 650000 WHEN 'SUP' THEN 780000 WHEN 'DLX' THEN 980000 WHEN 'FAM' THEN 1200000 ELSE base_daily_rate END,
    base_nightly_rate = CASE code WHEN 'STD' THEN 550000 WHEN 'SUP' THEN 680000 WHEN 'DLX' THEN 850000 WHEN 'FAM' THEN 1050000 ELSE base_nightly_rate END
WHERE code IN ('STD', 'SUP', 'DLX', 'FAM') AND deleted_at IS NULL;

UPDATE rate_plans SET rate = CASE code
    WHEN 'STD-HOUR' THEN 90000 WHEN 'STD-DAY' THEN 650000 WHEN 'STD-NIGHT' THEN 550000
    WHEN 'SUP-HOUR' THEN 110000 WHEN 'SUP-DAY' THEN 780000 WHEN 'SUP-NIGHT' THEN 680000
    WHEN 'DLX-HOUR' THEN 140000 WHEN 'DLX-DAY' THEN 980000 WHEN 'DLX-NIGHT' THEN 850000
    WHEN 'FAM-HOUR' THEN 170000 WHEN 'FAM-DAY' THEN 1200000 WHEN 'FAM-NIGHT' THEN 1050000
    ELSE rate END,
    min_stay_units = CASE WHEN pricing_unit = 'HOURLY' THEN 2 ELSE min_stay_units END
WHERE code IN ('STD-HOUR','STD-DAY','STD-NIGHT','SUP-HOUR','SUP-DAY','SUP-NIGHT',
               'DLX-HOUR','DLX-DAY','DLX-NIGHT','FAM-HOUR','FAM-DAY','FAM-NIGHT')
  AND deleted_at IS NULL;
