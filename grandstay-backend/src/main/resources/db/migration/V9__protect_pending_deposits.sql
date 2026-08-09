CREATE UNIQUE INDEX uq_payments_single_pending_deposit
    ON payments(booking_id)
    WHERE payment_type = 'PAYMENT'
      AND purpose = 'DEPOSIT'
      AND status = 'PENDING';
