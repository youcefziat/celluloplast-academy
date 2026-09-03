import { get } from 'svelte/store';
import { snackbar } from '$features/ui/snackbar/store';
import { accountApi } from '$features/account/api/account.svelte';
import { currentOrg, getOrgPublicOrigin } from '$lib/utils/store/org';

interface ViewAsStudentOptions {
  courseId?: string | null;
  currentOrgDomain?: string;
}

/**
 * "View as student" handoff. Mints a short-lived login-link token for the current
 * user and navigates to the org domain's `/api/auth/login-link`, which signs them in
 * there (host-only session) and redirects to the course's student view.
 *
 * Self-hosted: the dashboard's own `hooks.server.ts` proxies `/api/auth/*` to the API,
 * so the cookie lands on the deployment origin and the relative `redirect` resolves there.
 */
export async function viewAsStudent({ courseId, currentOrgDomain = '' }: ViewAsStudentOptions) {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!courseId) {
    return false;
  }

  const token = await accountApi.createViewAsStudentToken();
  if (!token) {
    snackbar.error('snackbar.view_as_student.failed');

    return false;
  }

  const origin = currentOrgDomain?.trim() || getOrgPublicOrigin(get(currentOrg));
  const loginLinkUrl = new URL('/api/auth/login-link', origin);
  loginLinkUrl.searchParams.set('token', token);
  loginLinkUrl.searchParams.set('redirect', `/courses/${courseId}/lessons?next=true`);

  // Cross-origin handoff — open in a new tab so the tutor keeps their dashboard.
  window.open(loginLinkUrl.toString(), '_blank', 'noopener,noreferrer');

  return true;
}
