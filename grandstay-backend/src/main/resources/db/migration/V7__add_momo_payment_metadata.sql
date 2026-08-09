ALTER TABLE payments DROP CONSTRAINT ck_payments_method;
ALTER TABLE payments
    ADD CONSTRAINT ck_payments_method
        CHECK (method IN ('CASH', 'QR', 'BANK_TRANSFER', 'CARD', 'MOMO'));

ALTER TABLE payments
    ADD COLUMN provider varchar(30),
    ADD COLUMN provider_order_id varchar(100),
    ADD COLUMN provider_request_id varchar(100);

CREATE UNIQUE INDEX uq_payments_provider_order
    ON payments(provider, provider_order_id)
    WHERE provider IS NOT NULL AND provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX uq_payments_provider_reference
    ON payments(provider, provider_reference)
    WHERE provider IS NOT NULL AND provider_reference IS NOT NULL;

CREATE INDEX idx_payments_provider_request
    ON payments(provider, provider_request_id)
    WHERE provider IS NOT NULL AND provider_request_id IS NOT NULL;
