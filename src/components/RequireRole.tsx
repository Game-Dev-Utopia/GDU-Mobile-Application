'use client';

import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { can, canAnyScope, rolesWithPermission, Role, Permission } from '@/lib/permissions';
import { redirect } from 'next/navigation';

type Scope = 'self' | 'team' | 'domain' | 'branch' | 'org';

interface RequireRoleProps {
  /** Permission(s) that grant access; any one is enough. */
  permission?: Permission | Permission[];
  /** If set, the permission must hold at exactly this scope. If omitted, any scope counts. */
  targetScope?: Scope;
  /** Roles that grant access regardless of the permission matrix. */
  roles?: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

function label(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RequireRole({
  permission,
  targetScope,
  roles,
  children,
  fallback,
}: RequireRoleProps) {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return fallback ?? null;
  }

  const userRoles = user.roles as Role[];
  const userScopes = user.scopes as Scope[];
  const permissions = permission ? (Array.isArray(permission) ? permission : [permission]) : [];

  const byPermission = permissions.some((perm) =>
    targetScope ? can(userRoles, perm, targetScope, userScopes) : canAnyScope(userRoles, perm)
  );
  const byRole = (roles ?? []).some((r) => userRoles.includes(r));
  const allowed = permissions.length === 0 && !roles ? true : byPermission || byRole;

  if (!allowed) {
    if (fallback) return <>{fallback}</>;
    const needed = Array.from(
      new Set([...(roles ?? []), ...permissions.flatMap((perm) => rolesWithPermission(perm))])
    ).map(label);
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
      >
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-rose-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="font-heading font-bold text-ink mb-2">Access Restricted</h3>
        <p className="text-mute">
          {needed.length > 0
            ? `You need one of these roles to view this page: ${needed.join(', ')}.`
            : "You don't have permission to view this page."}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Server-side redirect helper for route guards.
 * Use this in server components or getServerSideProps equivalents.
 */
export function requireRoleOrRedirect(
  userRoles: string[],
  userScopes: Scope[],
  permission: Permission,
  targetScope: Scope = 'self'
): void {
  if (!can(userRoles as Role[], permission, targetScope, userScopes)) {
    redirect('/');
  }
}
