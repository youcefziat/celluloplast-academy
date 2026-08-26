import { CELLULOPLAST_V1 } from '$lib/celluloplast/features';
import type { OrgLandingPageJson } from '$lib/utils/types/org';

function isPublicCatalogHref(href: string | undefined): boolean {
  if (!href) {
    return false;
  }

  const normalized = href.replace(/\/+$/, '') || '/';
  return normalized === '/courses';
}

/**
 * Strip public catalog links from org landing page settings when explore is disabled.
 */
export function applyCelluloplastLandingPagePolicy(settings: OrgLandingPageJson): OrgLandingPageJson {
  if (CELLULOPLAST_V1.exploreCatalog) {
    return settings;
  }

  const next = structuredClone(settings);

  next.navItems = (next.navItems ?? []).filter((item) => !isPublicCatalogHref(item.href));

  if (next.hero.secondaryAction && isPublicCatalogHref(next.hero.secondaryAction.href)) {
    next.hero.secondaryAction = {
      ...next.hero.secondaryAction,
      href: '/login'
    };
  }

  if (next.footer?.bottom?.links) {
    next.footer.bottom.links = next.footer.bottom.links.filter((link) => !isPublicCatalogHref(link.href));
  }

  for (const column of next.footer?.columns ?? []) {
    column.links = column.links.filter((link) => !isPublicCatalogHref(link.href));
  }

  return next;
}

/** Header link for public course pages when the org catalog is disabled. */
export function getCelluloplastPublicExploreHref(): string {
  return CELLULOPLAST_V1.exploreCatalog ? '/courses' : '/login';
}
