import type { TLocale } from '@cio/db/types';

/** Visible product branding for Celluloplast Academy (fork layer — no package renames). */
export const APP_DISPLAY_NAME = 'Celluloplast Academy';

/** Primary tenant slug for the internal Celluloplast organization (not the product name). */
export const PRIMARY_ORG_SITE_NAME = 'celluloplast';

/** Default UI locale for Celluloplast Academy. */
export const DEFAULT_LOCALE: TLocale = 'fr';

/** Treat legacy English DB defaults as unset until the user picks a language explicitly. */
export function resolveProfileLocale(profileLocale?: string | null): TLocale {
  if (!profileLocale || profileLocale === 'en') {
    return DEFAULT_LOCALE;
  }

  return profileLocale as TLocale;
}
export const APP_SHORT_NAME = 'Celluloplast Academy';
export const DEFAULT_LOGO_PATH = '/logo-192.png';
export const DEFAULT_LOGO_ALT = `${APP_DISPLAY_NAME} logo`;

/** HTML document title suffix, e.g. `Dashboard - Celluloplast Academy`. */
export function pageTitle(label: string): string {
  return `${label} - ${APP_DISPLAY_NAME}`;
}

/** Fallback when no org name is loaded yet (auth shell, avatars, etc.). */
export function appBrandFallback(orgName?: string | null): string {
  const trimmed = orgName?.trim();
  return trimmed || APP_DISPLAY_NAME;
}
