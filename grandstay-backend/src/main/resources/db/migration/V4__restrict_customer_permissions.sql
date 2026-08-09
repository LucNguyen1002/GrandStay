DELETE FROM role_permissions assignment
USING roles role, permissions permission
WHERE assignment.role_id = role.id
  AND assignment.permission_id = permission.id
  AND role.code = 'CUSTOMER'
  AND permission.code IN ('booking:read', 'booking:write');

COMMENT ON TABLE role_permissions IS 'CUSTOMER must not receive global booking permissions until booking ownership is enforced by the API.';
