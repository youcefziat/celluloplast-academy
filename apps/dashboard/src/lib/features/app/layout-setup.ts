import { getFirstOrg, getOrgBySiteName, getOrgsByCustomDomain } from '$features/org/api/org.server';

import type { AccountOrg } from '$features/app/types';
import type { Cookies } from '@sveltejs/kit';
import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { blockedSubdomain } from '$lib/utils/constants/app';
import { env } from '$env/dynamic/private';
import { getApiKeyHeaders } from '$lib/utils/services/api/server';

/**
 * Self-hosted resolves every request to the same single organization, so the record is
 * shared configuration rather than per-user data and is safe to hold in module scope.
 * Before this, the layout hit the API on every single page render.
 *
 * The trade-off is staleness: an edit to the org name or branding can take up to
 * SELF_HOSTED_ORG_CACHE_MS to appear. Keep that window short.
 */
const SELF_HOSTED_ORG_CACHE_MS = 30_000;
/** A failed lookup is re-tried quickly so the layout recovers as soon as the API is back. */
const SELF_HOSTED_ORG_RETRY_MS = 5_000;
/** This call blocks every page render, so it must fail fast rather than hang. */
const SELF_HOSTED_ORG_TIMEOUT_MS = 5_000;

let selfHostedOrgCache: { org: AccountOrg | null; expiresAt: number } | null = null;

async function getSelfHostedOrg(): Promise<AccountOrg | null> {
  const now = Date.now();

  if (selfHostedOrgCache && now < selfHostedOrgCache.expiresAt) {
    return selfHostedOrgCache.org;
  }

  const apiKeyHeaders = getApiKeyHeaders();
  const firstOrg = await getFirstOrg(apiKeyHeaders, { timeoutMs: SELF_HOSTED_ORG_TIMEOUT_MS });
  const org = (firstOrg as AccountOrg | null) ?? null;
  const ttl = org ? SELF_HOSTED_ORG_CACHE_MS : SELF_HOSTED_ORG_RETRY_MS;

  selfHostedOrgCache = { org, expiresAt: now + ttl };

  return org;
}

export interface OrgSiteInfo {
  isOrgSite: boolean;
  org: AccountOrg | null;
  subdomain: string;
  orgSiteName: string;
}

export async function getOrgSiteInfo(url: URL, cookies: Cookies): Promise<OrgSiteInfo> {
  const response: OrgSiteInfo = {
    orgSiteName: '',
    subdomain: '',
    isOrgSite: false,
    org: null
  };

  // Self-hosted: single org, single domain
  if (PUBLIC_IS_SELFHOSTED === 'true') {
    const firstOrg = await getSelfHostedOrg();
    if (firstOrg) {
      response.org = firstOrg as AccountOrg;
      response.isOrgSite = true;
      response.orgSiteName = firstOrg.siteName || '';
      response.subdomain = '';
    }

    return response;
  }

  const isLocalHost = url.host.includes('localhost');
  const tempSiteName = url.searchParams.get('org');

  if (isLocalHost && tempSiteName) {
    cookies.set('_orgSiteName', tempSiteName, {
      path: '/'
    });
  }

  const _orgSiteName = cookies.get('_orgSiteName');
  const debugMode = _orgSiteName && _orgSiteName !== 'false';

  const subdomain = getSubdomain(url) || '';

  // Custom domain
  if (isURLCustomDomain(url)) {
    console.log('it is custom domain');
    const apiKeyHeaders = getApiKeyHeaders();
    const orgs = await getOrgsByCustomDomain(url.hostname, true, apiKeyHeaders);

    if (!orgs || orgs.length === 0) {
      return response;
    }

    const org = orgs[0];
    response.org = org as AccountOrg;
    response.isOrgSite = true;
    response.orgSiteName = response.org?.siteName || '';
    response.subdomain = subdomain;

    return response;
  }

  // Subdomain except blocked ones.
  if (!blockedSubdomain.includes(subdomain)) {
    const APP_SUBDOMAINS = env.PRIVATE_APP_SUBDOMAINS?.split(',') || [];

    if (APP_SUBDOMAINS.includes(subdomain)) {
      return response;
    }

    response.isOrgSite = debugMode || !!subdomain;
    response.orgSiteName = debugMode ? _orgSiteName : subdomain;

    if (response.orgSiteName) {
      const apiKeyHeaders = getApiKeyHeaders();
      const org = await getOrgBySiteName(response.orgSiteName, apiKeyHeaders);
      response.org = org ?? null;
    }

    const shouldDeleteCookie = !response.org && _orgSiteName;
    if (shouldDeleteCookie) {
      cookies.delete('_orgSiteName', { path: '/' });
    }
  }

  return response;
}

function isURLCustomDomain(url: URL) {
  if (url.host.includes('localhost')) {
    return false;
  }

  const notCustomDomainHosts = [env.PRIVATE_APP_HOST || '', 'classroomio.com', 'myclassroomio.com'].filter(Boolean);

  return !notCustomDomainHosts.some((host) => url.host.endsWith(host));
}

export function getSubdomain(url: URL) {
  const appHost = env.PRIVATE_APP_HOST;
  if (!appHost) return null;

  const host = url.hostname.replace('www.', '');
  const parts = host.split('.');
  const appHostParts = appHost.split('.');
  const isAppHost = parts.slice(-appHostParts.length).join('.') === appHost;

  if (isAppHost) {
    // Subdomain exists only if extra part(s) before main domain
    return parts.length > appHostParts.length ? parts[0] : null;
  }

  return null;
}
