INSERT INTO permissions (code, name, description)
VALUES
    ('promotion:read', 'Read promotions', 'View promotions available for reservations'),
    ('promotion:write', 'Manage promotions', 'Create, update and retire promotions')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('promotion:read', 'promotion:write')
WHERE r.code IN ('ADMIN', 'MANAGER')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'promotion:read'
WHERE r.code IN ('RECEPTIONIST', 'CUSTOMER')
ON CONFLICT DO NOTHING;
