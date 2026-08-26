import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import {
  resolveCelluloplastPostAuthLanding,
  resolveCelluloplastPublicCatalogRedirect
} from '$lib/celluloplast/landing';
import { resolveCelluloplastRoleId } from '$lib/celluloplast/org-context';

interface CelluloplastPublicLandingRedirectInput {
  pathname: string;
  locals: App.Locals;
  orgSiteName?: string;
  orgId?: string;
}

/**
 * Server-side redirect for Celluloplast public entry pages.
 * Returns null when no redirect is needed (cloud mode or already on destination).
 */
export function getCelluloplastPublicLandingRedirect({
  pathname,
  locals,
  orgSiteName = '',
  orgId = ''
}: CelluloplastPublicLandingRedirectInput): string | null {
  if (PUBLIC_IS_SELFHOSTED !== 'true') {
    return null;
  }

  const isAuthenticated = !!locals.user;
  const orgRoles = (locals as { orgRoles?: Record<string, number> }).orgRoles ?? {};
  const organizations = locals.organizations ?? [];
  const hasOrganizations = organizations.length > 0 || Object.keys(orgRoles).length > 0;
  const resolvedSiteName = orgSiteName || organizations[0]?.siteName || '';
  const roleId = resolveCelluloplastRoleId(organizations, resolvedSiteName, orgRoles, orgId);

  const catalogRedirect = resolveCelluloplastPublicCatalogRedirect({
    pathname,
    isAuthenticated,
    roleId,
    orgSiteName: resolvedSiteName,
    hasOrganizations
  });

  if (catalogRedirect) {
    return catalogRedirect;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!hasOrganizations) {
    return null;
  }

  return resolveCelluloplastPostAuthLanding({
    pathname,
    roleId,
    orgSiteName: resolvedSiteName,
    hasOrganizations
  });
}
