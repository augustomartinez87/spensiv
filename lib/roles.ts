export type AppRole = 'admin' | 'viewer'

export const ADMIN_ONLY_ROUTES = [
  '/dashboard/loans',
  '/dashboard/portfolio',
  '/dashboard/persons',
  '/dashboard/simulator',
  '/dashboard/admin',
]

export function getUserRole(
  publicMetadata: Record<string, unknown> | null | undefined
): AppRole {
  const role = publicMetadata?.role
  if (role === 'admin') return 'admin'
  return 'viewer'
}

export function isAdmin(
  publicMetadata: Record<string, unknown> | null | undefined
): boolean {
  return publicMetadata?.role === 'admin'
}
