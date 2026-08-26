/** Visible product branding for Celluloplast Academy (fork layer — no package renames). */
export const APP_DISPLAY_NAME = 'Celluloplast Academy';
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
