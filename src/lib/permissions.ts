// RBAC: Permission matrix and can() helper
// Chain: Member → Team Lead/Domain Head → Council → Board

export type Role =
  | 'member'
  | 'senior_member'
  | 'team_lead'
  | 'domain_head'
  | 'council_member'
  | 'board_member'
  | 'faculty'
  | 'independent_contributor'
  | 'admin'
  | 'finance_compliance_officer'
  | 'conduct_panel_member'
  | 'auditor'
  | 'partner_rep';

export type Permission =
  | 'claim.submit_self'
  | 'claim.submit_on_behalf'
  | 'claim.review'
  | 'claim.finalize'
  | 'penalty.file'
  | 'activity.propose'
  | 'activity.approve_senior'
  | 'activity.approve_admin'
  | 'motion.create'
  | 'motion.vote'
  | 'branch_health.view'
  | 'roles.manage'
  | 'audit.view'
  | 'finance.release'
  | 'compliance.manage';

// Scope: who the role can act on
type Scope = 'self' | 'team' | 'domain' | 'branch' | 'org';

// Role hierarchy (lower index = lower authority)
const ROLE_HIERARCHY: Record<Role, number> = {
  member: 0,
  senior_member: 1,
  team_lead: 2,
  domain_head: 3,
  council_member: 4,
  board_member: 5,
  faculty: 5,
  independent_contributor: 1,
  admin: 6,
  finance_compliance_officer: 5,
  conduct_panel_member: 5,
  partner_rep: 0,
  auditor: 5,
};

// Permission matrix: role → permissions → allowed scopes
const PERMISSION_MATRIX: Record<Role, Record<Permission, Scope[]>> = {
  member: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': [],
    'claim.review': [],
    'claim.finalize': [],
    'penalty.file': [],
    'activity.propose': ['self'],
    'activity.approve_senior': [],
    'activity.approve_admin': [],
    'motion.create': ['org'],
    'motion.vote': ['org'],
    'branch_health.view': [],
    'roles.manage': [],
    'audit.view': [],
    'finance.release': [],
    'compliance.manage': [],
  },
  senior_member: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': [],
    'claim.review': [],
    'claim.finalize': [],
    'penalty.file': [],
    'activity.propose': ['self'],
    'activity.approve_senior': [],
    'activity.approve_admin': [],
    'motion.create': ['org'],
    'motion.vote': ['org'],
    'branch_health.view': [],
    'roles.manage': [],
    'audit.view': [],
    'finance.release': [],
    'compliance.manage': [],
  },
  team_lead: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': ['team'],
    'claim.review': ['team'],
    'claim.finalize': [],
    'penalty.file': ['team'], // minor penalties only
    'activity.propose': ['team'],
    'activity.approve_senior': ['team'],
    'activity.approve_admin': [],
    'motion.create': ['branch'],
    'motion.vote': ['branch'],
    'branch_health.view': ['branch'],
    'roles.manage': ['team'],
    'audit.view': [],
    'finance.release': [],
    'compliance.manage': [],
  },
  domain_head: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': ['domain'],
    'claim.review': ['domain'],
    'claim.finalize': ['domain'],
    'penalty.file': ['domain'], // moderate penalties
    'activity.propose': ['domain'],
    'activity.approve_senior': ['domain'],
    'activity.approve_admin': [],
    'motion.create': ['branch'],
    'motion.vote': ['branch'],
    'branch_health.view': ['branch'],
    'roles.manage': ['domain'],
    'audit.view': [],
    'finance.release': [],
    'compliance.manage': [],
  },
  council_member: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': ['branch'],
    'claim.review': ['branch'],
    'claim.finalize': ['branch'],
    'penalty.file': ['branch'],
    'activity.propose': ['branch'],
    'activity.approve_senior': ['branch'],
    'activity.approve_admin': [],
    'motion.create': ['org'],
    'motion.vote': ['org'],
    'branch_health.view': ['org'],
    'roles.manage': ['branch'],
    'audit.view': [],
    'finance.release': [],
    'compliance.manage': [],
  },
  board_member: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': ['org'],
    'claim.review': ['org'],
    'claim.finalize': ['org'],
    'penalty.file': ['org'],
    'activity.propose': ['org'],
    'activity.approve_senior': ['org'],
    'activity.approve_admin': ['org'],
    'motion.create': ['org'],
    'motion.vote': ['org'],
    'branch_health.view': ['org'],
    'roles.manage': ['org'],
    'audit.view': [],
    'finance.release': ['org'],
    'compliance.manage': ['org'],
  },
  faculty: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': [],
    'claim.review': ['org'], // mediation/review only
    'claim.finalize': [],
    'penalty.file': ['org'], // severe only, via Conduct Panel
    'activity.propose': [],
    'activity.approve_senior': [],
    'activity.approve_admin': [],
    'motion.create': [],
    'motion.vote': [],
    'branch_health.view': ['org'],
    'roles.manage': [],
    'audit.view': [],
    'finance.release': [],
    'compliance.manage': [],
  },
  independent_contributor: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': [],
    'claim.review': [],
    'claim.finalize': [],
    'penalty.file': [],
    'activity.propose': ['self'],
    'activity.approve_senior': [],
    'activity.approve_admin': [],
    'motion.create': ['org'],
    'motion.vote': ['org'],
    'branch_health.view': [],
    'roles.manage': [],
    'audit.view': [],
    'finance.release': [],
    'compliance.manage': [],
  },
  admin: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': ['org'],
    'claim.review': ['org'],
    'claim.finalize': ['org'],
    'penalty.file': ['org'],
    'activity.propose': ['org'],
    'activity.approve_senior': ['org'],
    'activity.approve_admin': ['org'],
    'motion.create': ['org'],
    'motion.vote': ['org'],
    'branch_health.view': ['org'],
    'roles.manage': ['org'],
    'audit.view': ['org'],
    'finance.release': [],
    'compliance.manage': [],
  },
  finance_compliance_officer: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': [],
    'claim.review': [],
    'claim.finalize': [],
    'penalty.file': [],
    'activity.propose': [],
    'activity.approve_senior': [],
    'activity.approve_admin': [],
    'motion.create': [],
    'motion.vote': [],
    'branch_health.view': [],
    'roles.manage': [],
    'audit.view': [],
    'finance.release': ['org'],
    'compliance.manage': ['org'],
  },
  conduct_panel_member: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': [],
    'claim.review': ['org'],
    'claim.finalize': [],
    'penalty.file': ['org'],
    'activity.propose': [],
    'activity.approve_senior': [],
    'activity.approve_admin': [],
    'motion.create': [],
    'motion.vote': [],
    'branch_health.view': ['org'],
    'roles.manage': [],
    'audit.view': ['org'],
    'finance.release': [],
    'compliance.manage': [],
  },
  auditor: {
    'claim.submit_self': ['self'],
    'claim.submit_on_behalf': [],
    'claim.review': [],
    'claim.finalize': [],
    'penalty.file': [],
    'activity.propose': [],
    'activity.approve_senior': [],
    'activity.approve_admin': [],
    'motion.create': [],
    'motion.vote': [],
    'branch_health.view': ['org'],
    'roles.manage': [],
    'audit.view': ['org'],
    'finance.release': [],
    'compliance.manage': [],
  },
  partner_rep: {
    'claim.submit_self': [],
    'claim.submit_on_behalf': [],
    'claim.review': [],
    'claim.finalize': [],
    'penalty.file': [],
    'activity.propose': [],
    'activity.approve_senior': [],
    'activity.approve_admin': [],
    'motion.create': [],
    'motion.vote': [],
    'branch_health.view': [],
    'roles.manage': [],
    'audit.view': [],
    'finance.release': [],
    'compliance.manage': [],
  },
};

// Role scopes: which scopes a role can operate within
const ROLE_SCOPES: Record<Role, Scope[]> = {
  member: ['self'],
  senior_member: ['self'],
  team_lead: ['self', 'team'],
  domain_head: ['self', 'domain'],
  council_member: ['self', 'branch', 'org'],
  board_member: ['self', 'org'],
  faculty: ['org'],
  independent_contributor: ['self', 'org'],
  admin: ['self', 'org'],
  finance_compliance_officer: ['org'],
  conduct_panel_member: ['org'],
  auditor: ['org'],
  partner_rep: [],
};

/**
 * Check if a user with given roles can perform a permission on a target scope.
 * @param userRoles - roles the user holds
 * @param permission - permission to check
 * @param targetScope - scope of the target (self, team, domain, branch, org)
 * @param userScope - the scope(s) the user is authorized for (from their role assignment)
 */
export function can(
  userRoles: Role[],
  permission: Permission,
  targetScope: Scope = 'self',
  userScopes: Scope[] = []
): boolean {
  // Check if any of the user's roles grants this permission at the target scope
  for (const role of userRoles) {
    const rolePerms = PERMISSION_MATRIX[role];
    if (!rolePerms) continue;

    const allowedScopes = rolePerms[permission];
    if (!allowedScopes || allowedScopes.length === 0) continue;

    // Check if the target scope is allowed by this role
    const scopeAllowed = allowedScopes.includes(targetScope);
    if (!scopeAllowed) continue;

    // Check if the user has this scope in their role assignment
    if (userScopes.length > 0 && !userScopes.includes(targetScope)) continue;

    return true;
  }

  return false;
}

/**
 * Check if role A is senior to role B in the hierarchy.
 */
export function isSeniorTo(roleA: Role, roleB: Role): boolean {
  return (ROLE_HIERARCHY[roleA] ?? 0) > (ROLE_HIERARCHY[roleB] ?? 0);
}

/**
 * Get all permissions for a role.
 */
export function getRolePermissions(role: Role): Record<Permission, Scope[]> {
  return PERMISSION_MATRIX[role] ?? {};
}

/**
 * Get all scopes for a role.
 */
export function getRoleScopes(role: Role): Scope[] {
  return ROLE_SCOPES[role] ?? [];
}

/**
 * Check if a user can submit a claim on behalf of another user.
 * Chain rule: Member → Team Lead/Domain Head → Council → Board
 * A user can only submit for those below them in their chain.
 */
export function canSubmitOnBehalf(
  submitterRole: Role,
  submitterScope: Scope,
  targetRole: Role,
  targetScope: Scope
): boolean {
  if (!can([submitterRole], 'claim.submit_on_behalf', targetScope, [submitterScope])) {
    return false;
  }

  // Cannot submit on behalf of someone at same or higher level
  if (ROLE_HIERARCHY[targetRole] >= ROLE_HIERARCHY[submitterRole]) {
    return false;
  }

  // Scope must be within submitter's authority
  const scopeOrder: Record<Scope, number> = {
    self: 0,
    team: 1,
    domain: 2,
    branch: 3,
    org: 4,
  };

  return scopeOrder[targetScope] <= scopeOrder[submitterScope];
}
