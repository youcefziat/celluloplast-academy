/**
 * Celluloplast Academy V1 post-auth landing policy (fork layer).
 *
 * Upstream treats org-site `/`, `/courses`, and `/login` as public pages and often
 * leaves authenticated users there. The internal academy should land on role home:
 *
 *   ADMIN / TUTOR → /org/{slug}/dash
 *   STUDENT       → /lms
 *
 * `/org/{slug}/courses` (Formations) stays reachable via navigation. The public
 * catalog at `/courses` is disabled when `CELLULOPLAST_V1.exploreCatalog` is false.
 */

import { CELLULOPLAST_V1 } from '$lib/celluloplast/features';
import { ROLE } from '@cio/utils/constants';

/** Paths that must not be the post-login landing for authenticated users. */
const PUBLIC_LANDING_PATHS = ['/', '/login', '/signup'] as const;

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

/** True when the pathname is the upstream public course catalog (not org workspace). */
export function isCelluloplastPublicCatalogPath(pathname: string): boolean {
  return normalizePath(pathname) === '/courses';
}

/** True when the pathname is a public marketing/auth entry (not org workspace routes). */
export function isCelluloplastPublicLandingPath(pathname: string): boolean {
  const path = normalizePath(pathname);

  if (isCelluloplastPublicCatalogPath(pathname)) {
    return !CELLULOPLAST_V1.exploreCatalog;
  }

  return PUBLIC_LANDING_PATHS.some((entry) => {
    if (entry === '/') {
      return path === '/';
    }

    return path === entry;
  });
}

export interface CelluloplastLandingInput {
  roleId: number;
  orgSiteName: string;
}

/** Role-based home route for Celluloplast V1. */
export function getCelluloplastLandingRoute({ roleId, orgSiteName }: CelluloplastLandingInput): string {
  if (roleId === ROLE.STUDENT) {
    return '/lms';
  }

  if (orgSiteName) {
    return `/org/${orgSiteName}/dash`;
  }

  return '/lms';
}

export interface ResolveCelluloplastPublicCatalogRedirectOptions {
  pathname: string;
  isAuthenticated: boolean;
  roleId?: number;
  orgSiteName?: string;
  hasOrganizations?: boolean;
}

/**
 * When the public catalog is disabled, `/courses` is not available to anyone.
 * Authenticated members go to their role home; everyone else goes to login.
 */
export function resolveCelluloplastPublicCatalogRedirect(
  options: ResolveCelluloplastPublicCatalogRedirectOptions
): string | null {
  if (CELLULOPLAST_V1.exploreCatalog) {
    return null;
  }

  if (!isCelluloplastPublicCatalogPath(options.pathname)) {
    return null;
  }

  if (options.isAuthenticated && options.hasOrganizations && options.roleId) {
    return getCelluloplastLandingRoute({
      roleId: options.roleId,
      orgSiteName: options.orgSiteName ?? ''
    });
  }

  return '/login';
}

export interface ResolveCelluloplastLandingOptions extends CelluloplastLandingInput {
  pathname: string;
  hasOrganizations: boolean;
}

/**
 * Returns a landing path when an authenticated user should leave a public entry page.
 * Returns null when no redirect is needed (already on destination, onboarding, etc.).
 */
export function resolveCelluloplastPostAuthLanding(options: ResolveCelluloplastLandingOptions): string | null {
  const { pathname, roleId, orgSiteName, hasOrganizations } = options;

  if (!hasOrganizations || !roleId) {
    return null;
  }

  if (!isCelluloplastPublicLandingPath(pathname)) {
    return null;
  }

  const landing = getCelluloplastLandingRoute({ roleId, orgSiteName });
  const current = normalizePath(pathname);
  const target = normalizePath(landing);

  if (current === target || pathname.startsWith(`${landing}/`)) {
    return null;
  }

  return landing;
}
