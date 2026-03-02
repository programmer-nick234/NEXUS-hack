import type { UserRole, ProtectedRouteConfig } from "@/types";

/**
 * Define which routes require which roles.
 * Routes not listed here are public.
 */
export const protectedRoutes: ProtectedRouteConfig[] = [
  { path: "/dashboard", roles: ["student", "admin", "mentor", "superadmin"] },
  { path: "/dashboard/overview", roles: ["student", "admin", "mentor", "superadmin"] },
  { path: "/dashboard/profile", roles: ["student", "admin", "mentor", "superadmin"] },
  { path: "/dashboard/admin", roles: ["admin", "superadmin"] },
];

/**
 * Check if a user role is authorized for a given path.
 */
export function isAuthorized(path: string, role?: UserRole): boolean {
  const route = protectedRoutes.find((r) => path.startsWith(r.path));
  if (!route) return true; // public route
  if (!role) return false;
  return route.roles.includes(role);
}

/**
 * Role hierarchy for comparison.
 */
export const roleHierarchy: Record<UserRole, number> = {
  student: 0,
  mentor: 1,
  admin: 2,
  superadmin: 3,
};

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[minRole];
}
