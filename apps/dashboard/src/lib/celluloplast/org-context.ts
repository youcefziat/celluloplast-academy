import type { AccountOrg } from '$features/app/types';
import { isOrgManagerRole } from '$lib/utils/store/org';
import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { PRIMARY_ORG_SITE_NAME } from '$lib/celluloplast/brand';
import { CELLULOPLAST_V1 } from '$lib/celluloplast/features';

/**
 * Celluloplast V1 is single-tenant on self-host. Upstream seed data still attaches
 * demo accounts to Coursera/Skillshare orgs — filter to the primary org so role
 * resolution does not fall back to a STUDENT membership elsewhere.
 */
export function filterCelluloplastOrganizations(organizations: AccountOrg[]): AccountOrg[] {
  if (PUBLIC_IS_SELFHOSTED !== 'true' || CELLULOPLAST_V1.multiOrganization) {
    return organizations;
  }

  const primary = organizations.find((org) => org.siteName === PRIMARY_ORG_SITE_NAME);
  if (primary) {
    return [primary];
  }

  const managed = organizations.filter((org) => isOrgManagerRole(org.roleId));
  if (managed.length > 0) {
    return [managed[0]];
  }

  return organizations.length > 0 ? [organizations[0]] : [];
}

export function resolveCelluloplastRoleId(
  organizations: AccountOrg[],
  orgSiteName: string,
  orgRoles: Record<string, number> = {},
  orgId?: string
): number {
  if (orgId && orgRoles[orgId]) {
    return orgRoles[orgId];
  }

  const scoped = filterCelluloplastOrganizations(organizations);
  const membership =
    scoped.find((org) => org.siteName === orgSiteName) ??
    scoped.find((org) => org.siteName === PRIMARY_ORG_SITE_NAME) ??
    scoped[0];

  return membership?.roleId ?? 0;
}
