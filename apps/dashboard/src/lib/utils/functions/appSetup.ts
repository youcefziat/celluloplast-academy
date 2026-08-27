import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { initPosthog, type PosthogBootstrapUser } from '$lib/utils/services/posthog';
import { initUmami } from '$lib/utils/services/umami';
import { initUserJot } from '$lib/utils/services/userjot';
import { licenseApi } from '$features/license/api/license.svelte';

let isTrackingInitialized = false;

function setupTracking(user?: PosthogBootstrapUser) {
  if (isTrackingInitialized) return;
  isTrackingInitialized = true;

  initPosthog(user);
  initUmami();
}

export function setupAnalytics(user?: PosthogBootstrapUser) {
  initUserJot();
  setupTracking(user);
}

/** Checks if this is cloud deployment and initializes analytics */
export function setupCloudAnalytics(user?: PosthogBootstrapUser) {
  if (PUBLIC_IS_SELFHOSTED !== 'true') {
    setupAnalytics(user);
  }
}

export function setupAnalyticsBasedOnLicense(user?: PosthogBootstrapUser) {
  initUserJot();

  // SaaS trackers (PostHog / Umami) are cloud-only. Self-hosted has no
  // tenant-router /ingest proxy, and ClassroomIO's PostHog project must not
  // receive events from private deployments.
  if (PUBLIC_IS_SELFHOSTED === 'true') {
    return;
  }

  if (licenseApi.hasAccess('no-tracking')) {
    return;
  }

  setupTracking(user);
}
