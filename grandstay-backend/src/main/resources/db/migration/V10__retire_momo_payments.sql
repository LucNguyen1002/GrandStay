UPDATE payments
SET status = 'FAILED',
    failure_reason = COALESCE(NULLIF(failure_reason, ''), 'MoMo payment method retired'),
    updated_at = CURRENT_TIMESTAMP
WHERE provider = 'MOMO'
  AND status = 'PENDING';
