import type { MetaTagsProps } from 'svelte-meta-tags';
import type { OrgSiteInfo } from '$features/app/layout-setup';
import { APP_DISPLAY_NAME } from '$lib/celluloplast/brand';
import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { env as publicEnv } from '$env/dynamic/public';
import { buildOrgSiteTitle, extractOrgSiteMetaCopy } from '$lib/utils/functions/org-site-meta';

const isSelfHosted = PUBLIC_IS_SELFHOSTED === 'true';

const DEFAULT_TITLE = `${APP_DISPLAY_NAME} | Plateforme de formation interne`;
const DEFAULT_DESCRIPTION = 'Plateforme de formation interne Celluloplast — parcours, progression et certifications.';
/** Image de partage par défaut, servie depuis `static/`. */
const DEFAULT_OG_IMAGE = '/logo-512.png';
const ORG_OG_WIDTH = 1200;
const ORG_OG_HEIGHT = 630;

async function resolveOgImageUrl(url: URL, orgSiteInfo: OrgSiteInfo): Promise<string> {
  const envUrl = publicEnv.PUBLIC_OG_IMAGE_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  if (isSelfHosted) {
    const org = orgSiteInfo.org;
    if (!org) {
      return DEFAULT_OG_IMAGE;
    }

    const orgImage =
      org.avatarUrl ||
      org.landingpage?.header?.banner?.image ||
      (org as { customization?: { dashboard?: { bannerImage?: string } } }).customization?.dashboard?.bannerImage;
    if (orgImage) {
      try {
        return new URL(orgImage, url.origin).href;
      } catch {
        // fall through to bundled default
      }
    }
  }

  return DEFAULT_OG_IMAGE;
}

function buildOrgOpenGraphImages(ogImageUrl: string, orgName: string) {
  return [
    {
      url: ogImageUrl,
      alt: `${orgName} learning platform`,
      width: ORG_OG_WIDTH,
      height: ORG_OG_HEIGHT,
      secureUrl: ogImageUrl.startsWith('https://') ? ogImageUrl : undefined,
      type: 'image/png'
    }
  ];
}

function resolveOrgSiteMeta(orgSiteInfo: OrgSiteInfo): {
  title: string;
  description: string;
  siteName: string;
} | null {
  const org = orgSiteInfo.org;
  if (!orgSiteInfo.isOrgSite || !org?.name?.trim()) {
    return null;
  }

  const orgName = org.name.trim();
  const metaCopy = extractOrgSiteMetaCopy(org.landingpage);

  return {
    title: publicEnv.PUBLIC_APP_TITLE?.trim() || buildOrgSiteTitle(orgName, metaCopy.heading),
    description:
      publicEnv.PUBLIC_APP_DESCRIPTION?.trim() ||
      metaCopy.description ||
      `Explore courses and training programs from ${orgName}.`,
    siteName: orgName
  };
}

export async function getBaseMetaTags(url: URL, orgSiteInfo: OrgSiteInfo): Promise<MetaTagsProps> {
  const orgMeta = resolveOrgSiteMeta(orgSiteInfo);

  const title =
    orgMeta?.title ||
    publicEnv.PUBLIC_APP_TITLE?.trim() ||
    (isSelfHosted && orgSiteInfo.org?.name ? `${orgSiteInfo.org.name} | Learning Platform` : DEFAULT_TITLE);

  const description = orgMeta?.description || publicEnv.PUBLIC_APP_DESCRIPTION?.trim() || DEFAULT_DESCRIPTION;

  const siteName =
    orgMeta?.siteName ||
    publicEnv.PUBLIC_APP_TITLE?.trim() ||
    (isSelfHosted && orgSiteInfo.org?.name ? orgSiteInfo.org.name : null) ||
    APP_DISPLAY_NAME;

  const ogImageUrl = await resolveOgImageUrl(url, orgSiteInfo);
  const usesDynamicOrgOg =
    orgSiteInfo.isOrgSite && Boolean(orgSiteInfo.org?.siteName) && !publicEnv.PUBLIC_OG_IMAGE_URL?.trim();

  const openGraphImages = usesDynamicOrgOg
    ? buildOrgOpenGraphImages(ogImageUrl, siteName)
    : [
        {
          url: ogImageUrl,
          alt: `${siteName} — plateforme de formation interne`,
          width: 1920,
          height: 1080,
          secureUrl: ogImageUrl.startsWith('https://') ? ogImageUrl : undefined,
          type: 'image/png'
        }
      ];

  const imageAlt = usesDynamicOrgOg
    ? `${siteName} — plateforme de formation`
    : `${siteName} — plateforme de formation interne`;

  return Object.freeze({
    title,
    description,
    canonical: new URL(url.pathname, url.origin).href,
    openGraph: {
      type: 'website',
      url: new URL(url.pathname, url.origin).href,
      locale: 'en_US',
      title,
      description,
      siteName,
      images: openGraphImages
    },
    twitter: {
      cardType: 'summary_large_image' as const,
      title,
      description,
      image: ogImageUrl,
      imageAlt
    }
  });
}
