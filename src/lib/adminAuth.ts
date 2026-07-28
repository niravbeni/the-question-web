/**
 * Prototype admin gate: requests must carry the admin password in the
 * `x-admin-key` header, matched against the ADMIN_PASSWORD env var.
 * In development with no password configured, access is allowed so local
 * testing stays frictionless; in production it is denied.
 */
export function isAdminRequest(req: Request): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-admin-key") === configured;
}
