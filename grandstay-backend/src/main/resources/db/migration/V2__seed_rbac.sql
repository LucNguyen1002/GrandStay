INSERT INTO roles (code, name, description, system_role)
VALUES
    ('ADMIN', 'Administrator', 'Full system administration', true),
    ('MANAGER', 'Manager', 'Hotel operations and financial management', true),
    ('RECEPTIONIST', 'Receptionist', 'Front desk operations', true),
    ('CUSTOMER', 'Customer', 'Customer self-service', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description)
VALUES
    ('user:read', 'Read users', 'View staff and user accounts'),
    ('user:write', 'Manage users', 'Create and update staff and user accounts'),
    ('room:read', 'Read rooms', 'View floors, rooms and room types'),
    ('room:write', 'Manage rooms', 'Manage floors, rooms, room types and rates'),
    ('booking:read', 'Read bookings', 'View reservations and stays'),
    ('booking:write', 'Manage bookings', 'Create, modify and cancel bookings'),
    ('booking:checkin', 'Check in', 'Check guests into rooms'),
    ('booking:checkout', 'Check out', 'Check guests out and issue invoices'),
    ('service:read', 'Read services', 'View the service catalog'),
    ('service:write', 'Manage services', 'Manage service catalog and usage'),
    ('payment:read', 'Read payments', 'View payment transactions'),
    ('payment:write', 'Manage payments', 'Record payments and refunds'),
    ('report:read', 'Read reports', 'View financial and operational reports'),
    ('audit:read', 'Read audit logs', 'View the immutable audit trail'),
    ('settings:write', 'Manage settings', 'Change system configuration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'room:read','room:write','booking:read','booking:write','service:read','service:write',
    'payment:read','report:read'
) WHERE r.code = 'MANAGER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'room:read','booking:read','booking:write','booking:checkin','booking:checkout',
    'service:read','service:write','payment:read','payment:write'
) WHERE r.code = 'RECEPTIONIST'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('room:read','booking:read','booking:write')
WHERE r.code = 'CUSTOMER'
ON CONFLICT DO NOTHING;
