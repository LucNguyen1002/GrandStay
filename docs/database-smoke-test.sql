\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    v_floor_id uuid;
    v_room_type_id uuid;
    v_room_id uuid;
    v_booking_1 uuid;
    v_booking_2 uuid;
    v_overlap_rejected boolean := false;
BEGIN
    INSERT INTO floors(code, name, floor_number)
    VALUES ('SMOKE-F1', 'Smoke test floor', 9999)
    RETURNING id INTO v_floor_id;

    INSERT INTO room_types(
        code, name, capacity_adults, capacity_children, base_nightly_rate
    ) VALUES (
        'SMOKE-DELUXE', 'Smoke Deluxe', 2, 1, 1000000
    ) RETURNING id INTO v_room_type_id;

    INSERT INTO rooms(room_number, floor_id, room_type_id)
    VALUES ('SMOKE-9999', v_floor_id, v_room_type_id)
    RETURNING id INTO v_room_id;

    INSERT INTO bookings(
        booking_source, status, expected_check_in_at, expected_check_out_at
    ) VALUES (
        'DIRECT', 'CONFIRMED', '2030-01-01 07:00:00+00', '2030-01-03 07:00:00+00'
    ) RETURNING id INTO v_booking_1;

    INSERT INTO booking_rooms(
        booking_id, room_id, stay_period, allocation_status,
        pricing_unit, unit_rate, quantity, room_charge
    ) VALUES (
        v_booking_1, v_room_id,
        tstzrange('2030-01-01 07:00:00+00', '2030-01-03 07:00:00+00', '[)'),
        'PENDING', 'NIGHTLY', 1000000, 2, 2000000
    );

    IF (SELECT allocation_status FROM booking_rooms WHERE booking_id = v_booking_1) <> 'CONFIRMED' THEN
        RAISE EXCEPTION 'Status synchronization trigger did not copy the parent booking status';
    END IF;

    INSERT INTO bookings(
        booking_source, status, expected_check_in_at, expected_check_out_at
    ) VALUES (
        'DIRECT', 'CONFIRMED', '2030-01-02 07:00:00+00', '2030-01-04 07:00:00+00'
    ) RETURNING id INTO v_booking_2;

    BEGIN
        INSERT INTO booking_rooms(
            booking_id, room_id, stay_period, allocation_status,
            pricing_unit, unit_rate, quantity, room_charge
        ) VALUES (
            v_booking_2, v_room_id,
            tstzrange('2030-01-02 07:00:00+00', '2030-01-04 07:00:00+00', '[)'),
            'CONFIRMED', 'NIGHTLY', 1000000, 2, 2000000
        );
    EXCEPTION
        WHEN exclusion_violation THEN
            v_overlap_rejected := true;
    END;

    IF NOT v_overlap_rejected THEN
        RAISE EXCEPTION 'Overlapping active booking was not rejected';
    END IF;

    UPDATE bookings SET status = 'CANCELLED' WHERE id = v_booking_2;

    INSERT INTO booking_rooms(
        booking_id, room_id, stay_period, allocation_status,
        pricing_unit, unit_rate, quantity, room_charge
    ) VALUES (
        v_booking_2, v_room_id,
        tstzrange('2030-01-02 07:00:00+00', '2030-01-04 07:00:00+00', '[)'),
        'CONFIRMED', 'NIGHTLY', 1000000, 2, 2000000
    );

    IF (SELECT allocation_status FROM booking_rooms WHERE booking_id = v_booking_2) <> 'CANCELLED' THEN
        RAISE EXCEPTION 'Cancelled booking room must remain non-blocking';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'GrandStay database smoke test passed' AS result;
