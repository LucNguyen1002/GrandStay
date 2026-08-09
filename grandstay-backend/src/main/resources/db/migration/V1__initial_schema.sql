CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(80) NOT NULL,
    email varchar(254) NOT NULL,
    password_hash varchar(100) NOT NULL,
    full_name varchar(150) NOT NULL,
    phone varchar(30),
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    last_login_at timestamptz,
    failed_login_attempts integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
    CONSTRAINT ck_users_failed_logins CHECK (failed_login_attempts >= 0)
);
CREATE UNIQUE INDEX uq_users_username_active ON users (lower(username)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_email_active ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    description varchar(500),
    system_role boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz
);

CREATE TABLE permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100) NOT NULL UNIQUE,
    name varchar(150) NOT NULL,
    description varchar(500),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

CREATE TABLE role_permissions (
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

CREATE TABLE refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash varchar(64) NOT NULL UNIQUE,
    family_id uuid NOT NULL,
    parent_token_id uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    revoke_reason varchar(100),
    replaced_by_token_id uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    user_agent varchar(500),
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_refresh_token_expiry CHECK (expires_at > created_at),
    CONSTRAINT ck_refresh_token_revoke CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code varchar(30) NOT NULL UNIQUE,
    full_name varchar(150) NOT NULL,
    email varchar(254),
    phone varchar(30),
    nationality varchar(2),
    date_of_birth date,
    gender varchar(20),
    address varchar(500),
    identity_type varchar(20),
    identity_ciphertext text,
    identity_hash varchar(64),
    notes varchar(1000),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    CONSTRAINT ck_customers_gender CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED')),
    CONSTRAINT ck_customers_identity_type CHECK (identity_type IS NULL OR identity_type IN ('NATIONAL_ID', 'PASSPORT', 'OTHER')),
    CONSTRAINT ck_customers_identity_pair CHECK ((identity_ciphertext IS NULL) = (identity_hash IS NULL))
);
CREATE UNIQUE INDEX uq_customers_identity_hash ON customers(identity_hash) WHERE identity_hash IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_customers_name ON customers(lower(full_name)) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE floors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(30) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    floor_number integer NOT NULL UNIQUE,
    description varchar(500),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz
);

CREATE TABLE room_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(30) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    description varchar(1000),
    capacity_adults integer NOT NULL,
    capacity_children integer NOT NULL DEFAULT 0,
    base_hourly_rate numeric(19,2),
    base_daily_rate numeric(19,2),
    base_nightly_rate numeric(19,2) NOT NULL,
    currency varchar(3) NOT NULL DEFAULT 'VND',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    CONSTRAINT ck_room_types_capacity CHECK (capacity_adults > 0 AND capacity_children >= 0),
    CONSTRAINT ck_room_types_rates CHECK (
        (base_hourly_rate IS NULL OR base_hourly_rate >= 0) AND
        (base_daily_rate IS NULL OR base_daily_rate >= 0) AND
        base_nightly_rate >= 0
    )
);
CREATE INDEX idx_room_types_active ON room_types(name) WHERE deleted_at IS NULL;

CREATE TABLE amenities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    description varchar(500),
    icon varchar(100),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz
);

CREATE TABLE room_type_amenities (
    room_type_id uuid NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
    quantity integer NOT NULL DEFAULT 1,
    PRIMARY KEY (room_type_id, amenity_id),
    CONSTRAINT ck_room_type_amenities_quantity CHECK (quantity > 0)
);
CREATE INDEX idx_room_type_amenities_amenity ON room_type_amenities(amenity_id);

CREATE TABLE rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number varchar(20) NOT NULL UNIQUE,
    floor_id uuid NOT NULL REFERENCES floors(id) ON DELETE RESTRICT,
    room_type_id uuid NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
    operational_status varchar(20) NOT NULL DEFAULT 'AVAILABLE',
    notes varchar(1000),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    CONSTRAINT ck_rooms_operational_status CHECK (operational_status IN ('AVAILABLE', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE'))
);
CREATE INDEX idx_rooms_floor_status ON rooms(floor_id, operational_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_rooms_type ON rooms(room_type_id) WHERE deleted_at IS NULL;

CREATE TABLE rate_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id uuid NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
    code varchar(50) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    pricing_unit varchar(20) NOT NULL,
    rate numeric(19,2) NOT NULL,
    currency varchar(3) NOT NULL DEFAULT 'VND',
    valid_from date,
    valid_to date,
    min_stay_units integer NOT NULL DEFAULT 1,
    refundable boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    CONSTRAINT ck_rate_plans_unit CHECK (pricing_unit IN ('HOURLY', 'DAILY', 'NIGHTLY')),
    CONSTRAINT ck_rate_plans_rate CHECK (rate >= 0 AND min_stay_units > 0),
    CONSTRAINT ck_rate_plans_dates CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);
CREATE INDEX idx_rate_plans_lookup ON rate_plans(room_type_id, active, valid_from, valid_to) WHERE deleted_at IS NULL;

CREATE TABLE promotions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name varchar(150) NOT NULL,
    description varchar(1000),
    discount_type varchar(20) NOT NULL,
    discount_value numeric(19,2) NOT NULL,
    maximum_discount numeric(19,2),
    minimum_booking_amount numeric(19,2) NOT NULL DEFAULT 0,
    valid_from timestamptz NOT NULL,
    valid_to timestamptz NOT NULL,
    usage_limit integer,
    used_count integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    CONSTRAINT ck_promotions_type CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    CONSTRAINT ck_promotions_value CHECK (
        discount_value > 0 AND
        (discount_type <> 'PERCENTAGE' OR discount_value <= 100) AND
        (maximum_discount IS NULL OR maximum_discount >= 0) AND
        minimum_booking_amount >= 0
    ),
    CONSTRAINT ck_promotions_dates CHECK (valid_to > valid_from),
    CONSTRAINT ck_promotions_usage CHECK (used_count >= 0 AND (usage_limit IS NULL OR (usage_limit > 0 AND used_count <= usage_limit)))
);
CREATE INDEX idx_promotions_active_period ON promotions(active, valid_from, valid_to) WHERE deleted_at IS NULL;

CREATE SEQUENCE booking_number_seq START 1000;
CREATE TABLE bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_number varchar(30) NOT NULL UNIQUE DEFAULT ('BKG-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(nextval('booking_number_seq')::text, 6, '0')),
    customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
    promotion_id uuid REFERENCES promotions(id) ON DELETE RESTRICT,
    booking_source varchar(20) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    expected_check_in_at timestamptz NOT NULL,
    expected_check_out_at timestamptz NOT NULL,
    actual_check_in_at timestamptz,
    actual_check_out_at timestamptz,
    adults integer NOT NULL DEFAULT 1,
    children integer NOT NULL DEFAULT 0,
    special_requests varchar(2000),
    currency varchar(3) NOT NULL DEFAULT 'VND',
    discount_amount numeric(19,2) NOT NULL DEFAULT 0,
    tax_rate numeric(7,4) NOT NULL DEFAULT 0,
    cancellation_reason varchar(1000),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    CONSTRAINT ck_bookings_source CHECK (booking_source IN ('DIRECT', 'WALK_IN', 'ONLINE', 'PHONE', 'OTA')),
    CONSTRAINT ck_bookings_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW')),
    CONSTRAINT ck_bookings_expected_period CHECK (expected_check_out_at > expected_check_in_at),
    CONSTRAINT ck_bookings_actual_period CHECK (actual_check_out_at IS NULL OR (actual_check_in_at IS NOT NULL AND actual_check_out_at > actual_check_in_at)),
    CONSTRAINT ck_bookings_guests CHECK (adults > 0 AND children >= 0),
    CONSTRAINT ck_bookings_amounts CHECK (discount_amount >= 0 AND tax_rate >= 0 AND tax_rate <= 100)
);
CREATE INDEX idx_bookings_customer ON bookings(customer_id, created_at DESC);
CREATE INDEX idx_bookings_status_period ON bookings(status, expected_check_in_at, expected_check_out_at);
CREATE INDEX idx_bookings_created ON bookings(created_at DESC);

CREATE TABLE booking_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    rate_plan_id uuid REFERENCES rate_plans(id) ON DELETE RESTRICT,
    stay_period tstzrange NOT NULL,
    allocation_status varchar(20) NOT NULL,
    pricing_unit varchar(20) NOT NULL,
    unit_rate numeric(19,2) NOT NULL,
    quantity numeric(12,2) NOT NULL,
    room_charge numeric(19,2) NOT NULL,
    tax_rate numeric(7,4) NOT NULL DEFAULT 0,
    adults integer NOT NULL DEFAULT 1,
    children integer NOT NULL DEFAULT 0,
    checked_in_at timestamptz,
    checked_out_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    CONSTRAINT uq_booking_rooms_id_booking UNIQUE (id, booking_id),
    CONSTRAINT uq_booking_rooms_booking_room UNIQUE (booking_id, room_id),
    CONSTRAINT ck_booking_rooms_period CHECK (NOT isempty(stay_period) AND lower_inc(stay_period) AND NOT upper_inc(stay_period) AND lower(stay_period) IS NOT NULL AND upper(stay_period) IS NOT NULL),
    CONSTRAINT ck_booking_rooms_status CHECK (allocation_status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW')),
    CONSTRAINT ck_booking_rooms_unit CHECK (pricing_unit IN ('HOURLY', 'DAILY', 'NIGHTLY')),
    CONSTRAINT ck_booking_rooms_price CHECK (unit_rate >= 0 AND quantity > 0 AND room_charge >= 0 AND tax_rate >= 0 AND tax_rate <= 100),
    CONSTRAINT ck_booking_rooms_guests CHECK (adults > 0 AND children >= 0),
    CONSTRAINT ck_booking_rooms_checkout CHECK (checked_out_at IS NULL OR (checked_in_at IS NOT NULL AND checked_out_at > checked_in_at))
);
ALTER TABLE booking_rooms ADD CONSTRAINT booking_rooms_no_overlap
    EXCLUDE USING gist (room_id WITH =, stay_period WITH &&)
    WHERE (allocation_status IN ('CONFIRMED', 'CHECKED_IN'))
    DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX idx_booking_rooms_booking ON booking_rooms(booking_id);
CREATE INDEX idx_booking_rooms_room_period ON booking_rooms USING gist(room_id, stay_period);

CREATE OR REPLACE FUNCTION sync_booking_room_status()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status varchar(20);
BEGIN
    SELECT status INTO STRICT parent_status FROM bookings WHERE id = NEW.booking_id FOR KEY SHARE;
    NEW.allocation_status = parent_status;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_booking_rooms_sync_status
BEFORE INSERT OR UPDATE OF booking_id, allocation_status ON booking_rooms
FOR EACH ROW EXECUTE FUNCTION sync_booking_room_status();

CREATE OR REPLACE FUNCTION propagate_booking_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE booking_rooms SET allocation_status = NEW.status WHERE booking_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bookings_propagate_status
AFTER UPDATE OF status ON bookings
FOR EACH ROW EXECUTE FUNCTION propagate_booking_status();

CREATE TABLE booking_guests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
    full_name varchar(150) NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    nationality varchar(2),
    date_of_birth date,
    identity_type varchar(20),
    identity_ciphertext text,
    identity_hash varchar(64),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    CONSTRAINT ck_booking_guests_identity_type CHECK (identity_type IS NULL OR identity_type IN ('NATIONAL_ID', 'PASSPORT', 'OTHER')),
    CONSTRAINT ck_booking_guests_identity_pair CHECK ((identity_ciphertext IS NULL) = (identity_hash IS NULL))
);
CREATE UNIQUE INDEX uq_booking_guests_primary ON booking_guests(booking_id) WHERE is_primary;
CREATE INDEX idx_booking_guests_booking ON booking_guests(booking_id);
CREATE INDEX idx_booking_guests_identity_hash ON booking_guests(identity_hash) WHERE identity_hash IS NOT NULL;

CREATE TABLE services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name varchar(150) NOT NULL,
    category varchar(50) NOT NULL,
    description varchar(1000),
    unit varchar(30) NOT NULL,
    unit_price numeric(19,2) NOT NULL,
    tax_rate numeric(7,4) NOT NULL DEFAULT 0,
    currency varchar(3) NOT NULL DEFAULT 'VND',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    CONSTRAINT ck_services_price CHECK (unit_price >= 0 AND tax_rate >= 0 AND tax_rate <= 100)
);
CREATE INDEX idx_services_active_category ON services(category, name) WHERE active AND deleted_at IS NULL;

CREATE TABLE booking_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    booking_room_id uuid,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    service_name varchar(150) NOT NULL,
    unit varchar(30) NOT NULL,
    unit_price numeric(19,2) NOT NULL,
    quantity numeric(12,2) NOT NULL,
    tax_rate numeric(7,4) NOT NULL DEFAULT 0,
    service_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes varchar(500),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    CONSTRAINT ck_booking_services_amount CHECK (unit_price >= 0 AND quantity > 0 AND tax_rate >= 0 AND tax_rate <= 100),
    CONSTRAINT fk_booking_services_room_booking
        FOREIGN KEY (booking_room_id, booking_id)
        REFERENCES booking_rooms(id, booking_id) ON DELETE RESTRICT
);
CREATE INDEX idx_booking_services_booking_time ON booking_services(booking_id, service_at);
CREATE INDEX idx_booking_services_service_time ON booking_services(service_id, service_at);

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    original_payment_id uuid REFERENCES payments(id) ON DELETE RESTRICT,
    transaction_code varchar(100) NOT NULL UNIQUE,
    payment_type varchar(20) NOT NULL,
    purpose varchar(20) NOT NULL,
    method varchar(20) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    amount numeric(19,2) NOT NULL,
    currency varchar(3) NOT NULL DEFAULT 'VND',
    paid_at timestamptz,
    provider_reference varchar(150),
    failure_reason varchar(500),
    notes varchar(500),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    CONSTRAINT ck_payments_type CHECK (payment_type IN ('PAYMENT', 'REFUND')),
    CONSTRAINT ck_payments_purpose CHECK (purpose IN ('DEPOSIT', 'SETTLEMENT', 'EXTRA', 'REFUND')),
    CONSTRAINT ck_payments_method CHECK (method IN ('CASH', 'QR', 'BANK_TRANSFER', 'CARD')),
    CONSTRAINT ck_payments_status CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
    CONSTRAINT ck_payments_amount CHECK (amount > 0),
    CONSTRAINT ck_payments_refund_link CHECK ((payment_type = 'REFUND') = (original_payment_id IS NOT NULL)),
    CONSTRAINT ck_payments_paid_at CHECK (status <> 'COMPLETED' OR paid_at IS NOT NULL)
);
CREATE INDEX idx_payments_booking_status ON payments(booking_id, status, created_at);
CREATE INDEX idx_payments_original ON payments(original_payment_id) WHERE original_payment_id IS NOT NULL;

CREATE SEQUENCE invoice_number_seq START 1000;
CREATE TABLE invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number varchar(30) NOT NULL UNIQUE DEFAULT ('INV-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0')),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    status varchar(20) NOT NULL DEFAULT 'DRAFT',
    issued_at timestamptz,
    due_at timestamptz,
    customer_name varchar(150) NOT NULL,
    customer_tax_code varchar(50),
    billing_address varchar(500),
    currency varchar(3) NOT NULL DEFAULT 'VND',
    room_charge numeric(19,2) NOT NULL DEFAULT 0,
    service_charge numeric(19,2) NOT NULL DEFAULT 0,
    extra_fee numeric(19,2) NOT NULL DEFAULT 0,
    discount_amount numeric(19,2) NOT NULL DEFAULT 0,
    tax_amount numeric(19,2) NOT NULL DEFAULT 0,
    grand_total numeric(19,2) NOT NULL DEFAULT 0,
    notes varchar(1000),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version bigint NOT NULL DEFAULT 0,
    CONSTRAINT ck_invoices_status CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'VOID')),
    CONSTRAINT ck_invoices_amounts CHECK (
        room_charge >= 0 AND service_charge >= 0 AND extra_fee >= 0 AND
        discount_amount >= 0 AND tax_amount >= 0 AND grand_total >= 0 AND
        grand_total = round(room_charge + service_charge + extra_fee - discount_amount + tax_amount, 2)
    ),
    CONSTRAINT ck_invoices_issue CHECK (status = 'DRAFT' OR issued_at IS NOT NULL),
    CONSTRAINT ck_invoices_due CHECK (due_at IS NULL OR issued_at IS NULL OR due_at >= issued_at)
);
CREATE INDEX idx_invoices_booking ON invoices(booking_id, created_at DESC);
CREATE INDEX idx_invoices_status_issued ON invoices(status, issued_at DESC);

CREATE TABLE invoice_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    item_type varchar(20) NOT NULL,
    reference_id uuid,
    description varchar(500) NOT NULL,
    unit varchar(30) NOT NULL,
    quantity numeric(12,2) NOT NULL,
    unit_price numeric(19,2) NOT NULL,
    discount_amount numeric(19,2) NOT NULL DEFAULT 0,
    tax_rate numeric(7,4) NOT NULL DEFAULT 0,
    tax_amount numeric(19,2) NOT NULL DEFAULT 0,
    line_total numeric(19,2) NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_invoice_items_type CHECK (item_type IN ('ROOM', 'SERVICE', 'EXTRA_FEE', 'DISCOUNT', 'TAX')),
    CONSTRAINT ck_invoice_items_amount CHECK (
        quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND
        tax_rate >= 0 AND tax_rate <= 100 AND tax_amount >= 0 AND line_total >= 0
    )
);
CREATE INDEX idx_invoice_items_invoice_order ON invoice_items(invoice_id, display_order);

CREATE TABLE audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action varchar(100) NOT NULL,
    entity_type varchar(100) NOT NULL,
    entity_id varchar(100) NOT NULL,
    request_id varchar(100),
    ip_address inet,
    changes jsonb,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_audit_logs_changes_object CHECK (changes IS NULL OR jsonb_typeof(changes) = 'object')
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_logs_occurred ON audit_logs(occurred_at DESC);

DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'roles', 'permissions', 'customers', 'floors', 'room_types',
        'amenities', 'rooms', 'rate_plans', 'promotions', 'bookings',
        'booking_rooms', 'booking_guests', 'services', 'booking_services',
        'payments', 'invoices'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            'trg_' || table_name || '_updated_at',
            table_name
        );
    END LOOP;
END;
$$;

COMMENT ON COLUMN booking_rooms.allocation_status IS 'Database-maintained copy of bookings.status used by the room overlap exclusion constraint.';
COMMENT ON COLUMN customers.identity_ciphertext IS 'Application-encrypted identity number; must never be logged.';
COMMENT ON COLUMN customers.identity_hash IS 'SHA-256/HMAC blind index for exact identity lookup.';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hash only; the raw refresh token is never persisted.';
