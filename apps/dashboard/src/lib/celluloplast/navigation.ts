/**
 * Celluloplast Academy V1 navigation policy (fork layer).
 *
 * Upstream ClassroomIO exposes every surface it ships (community, AI, widgets, automation,
 * billing, cohorts…). The internal academy only needs three role journeys:
 *
 * | ADMIN          | TUTOR          | STUDENT         |
 * |----------------|----------------|-----------------|
 * | Accueil        | Accueil        | Accueil         |
 * | Formations     | Mes formations | Mes formations  |
 * | Employés       | Apprenants     | Mes certificats |
 * | Progression    | Progression    |                 |
 * | Certifications | Certifications |                 |
 * | Administration |                |                 |
 *
 * Instead of editing the upstream configs (which would conflict on every rebase), this module
 * takes them as input and returns the V1 allowlist: entries are reused from upstream by `path`
 * so their `matchPattern`, `nestedRoutes` and sub-items keep working, and only the label, icon
 * and role gate are overridden here. Anything not listed is hidden — including from the
 * breadcrumbs and the command palette, which read the same configs.
 *
 * Role gating reuses upstream's `requiresAdmin` flag; no new role system is introduced.
 */

import type { NavItemConfig as LmsNavItemConfig } from '$features/ui/navigation/lms-navigation';
import type { NavItemConfig as OrgNavItemConfig } from '$features/ui/navigation/org-navigation';
import { CertificateIcon, ChartColumnIcon, HomeIcon } from '@cio/ui/custom/moving-icons';
import { CELLULOPLAST_HIDDEN_COURSE_NAV_IDS } from './course-authoring';

interface KeptSubItem {
  /** Path of the upstream sub-item to keep. */
  path: string;
  /** Nested breadcrumb routes kept under that sub-item, by relative path. */
  keepNestedRoutes?: string[];
}

interface OrgNavEntry {
  /** Upstream entry reused for this item, or the fork route when upstream has none. */
  path: string;
  /** Label for tutors (and for admins when `adminTitleKey` is not set). */
  titleKey: string;
  /** Label shown to admins when it differs from the tutor one. */
  adminTitleKey?: string;
  icon?: Component;
  requiresAdmin?: boolean;
  matchPattern?: string;
  keepItems?: KeptSubItem[];
  keepNestedRoutes?: string[];
}

/**
 * V1 org workspace navigation, in sidebar order. Everything renders as one flat group
 * (`group: null`), so the order below is what admins and tutors actually see.
 *
 * Hidden on purpose: the org home (AI course creator — `/org/{slug}` redirects to `/dash`),
 * cohorts, media, tags, widgets, community, setup, MCP, public API and Zapier.
 */
const ORG_NAV_V1: OrgNavEntry[] = [
  {
    // Upstream's `/dash` is the real admin/tutor dashboard; upstream's `` home is the AI
    // course creator, which V1 excludes.
    path: '/dash',
    titleKey: 'celluloplast_navigation.home',
    icon: HomeIcon
  },
  {
    path: '/courses',
    titleKey: 'celluloplast_navigation.my_trainings',
    adminTitleKey: 'celluloplast_navigation.trainings'
  },
  {
    path: '/audience',
    titleKey: 'celluloplast_navigation.learners',
    adminTitleKey: 'celluloplast_navigation.employees'
  },
  {
    // Fork route: org-wide learner × training progress (any course type).
    path: '/progress',
    titleKey: 'celluloplast_navigation.progress',
    icon: ChartColumnIcon,
    matchPattern: '^/org/[^/]+/progress(/.*)?$'
    // Visible to ADMIN and TUTOR (tutors are scoped server-side to their courses).
  },
  {
    // Fork route: org-wide view of issued certificates (admins and tutors).
    path: '/certifications',
    titleKey: 'celluloplast_navigation.certifications',
    icon: CertificateIcon,
    matchPattern: '^/org/[^/]+/certifications(/.*)?$'
  },
  {
    path: '/settings',
    titleKey: 'celluloplast_navigation.administration',
    requiresAdmin: true,
    keepItems: [
      { path: '/settings' },
      { path: '/settings/notifications' },
      { path: '/settings/org', keepNestedRoutes: ['teams', 'customize-lms'] }
    ],
    keepNestedRoutes: ['notifications', 'teams', 'customize-lms']
  }
];

interface LmsNavEntry {
  path: string;
  titleKey: string;
  /** Drop upstream's `show` gate (certificates are plan-gated upstream). */
  alwaysShow?: boolean;
}

/**
 * V1 learner navigation, in sidebar order. Explore, cohorts, exercises, community and the
 * settings group are hidden; the learner profile stays reachable from the sidebar footer menu.
 */
const LMS_NAV_V1: LmsNavEntry[] = [
  { path: '', titleKey: 'celluloplast_navigation.home' },
  { path: '/mylearning', titleKey: 'celluloplast_navigation.my_trainings' },
  { path: '/certificates', titleKey: 'celluloplast_navigation.my_certificates', alwaysShow: true }
];

/** Org settings tabs kept in V1 (custom domains are out of scope). */
const ORG_SETTINGS_TABS_V1 = ['/settings/org', '/settings/teams', '/settings/customize-lms'];

function findUpstreamEntry(configs: OrgNavItemConfig[], path: string): OrgNavItemConfig | undefined {
  for (const config of configs) {
    if (config.path === path) {
      return config;
    }

    const subConfig = config.items?.find((item) => item.path === path);

    if (subConfig) {
      return subConfig;
    }
  }

  return undefined;
}

function keepNestedRoutes(config: OrgNavItemConfig | undefined, kept: string[] | undefined) {
  if (!config?.nestedRoutes || !kept) {
    return undefined;
  }

  return kept
    .map((path) => config.nestedRoutes?.find((route) => route.path === path))
    .filter((route) => route !== undefined);
}

function keepSubItems(config: OrgNavItemConfig | undefined, kept: KeptSubItem[] | undefined) {
  if (!config?.items || !kept) {
    return undefined;
  }

  return kept
    .map((keptItem) => {
      const subConfig = config.items?.find((item) => item.path === keptItem.path);

      if (!subConfig) {
        return undefined;
      }

      return {
        ...subConfig,
        isPaid: undefined,
        nestedRoutes: keepNestedRoutes(subConfig, keptItem.keepNestedRoutes)
      };
    })
    .filter((item) => item !== undefined);
}

/**
 * Reduce the upstream org navigation to the V1 allowlist.
 *
 * `isOrgAdmin` only selects the admin wording (Formations / Employés); which items an admin or
 * a tutor may open is still decided by upstream's `requiresAdmin` handling downstream.
 */
export function applyOrgNavPolicy(upstream: OrgNavItemConfig[], isOrgAdmin: boolean | null): OrgNavItemConfig[] {
  return ORG_NAV_V1.map((entry) => {
    const inherited = findUpstreamEntry(upstream, entry.path);
    const titleKey = isOrgAdmin && entry.adminTitleKey ? entry.adminTitleKey : entry.titleKey;

    return {
      ...inherited,
      titleKey,
      path: entry.path,
      icon: entry.icon ?? inherited?.icon,
      matchPattern: entry.matchPattern ?? inherited?.matchPattern,
      requiresAdmin: entry.requiresAdmin,
      // V1 renders a single flat list in the order declared above.
      group: null,
      // Plan markers belong to the hidden billing surface.
      isPaid: undefined,
      upgradeResource: undefined,
      items: keepSubItems(inherited, entry.keepItems),
      nestedRoutes: keepNestedRoutes(inherited, entry.keepNestedRoutes)
    } satisfies OrgNavItemConfig;
  });
}

/** Reduce the upstream learner navigation to the V1 allowlist. */
export function applyLmsNavPolicy(upstream: LmsNavItemConfig[]): LmsNavItemConfig[] {
  return LMS_NAV_V1.map((entry) => {
    const inherited = upstream.find((config) => config.path === entry.path);

    return {
      ...inherited,
      titleKey: entry.titleKey,
      path: entry.path,
      show: entry.alwaysShow ? undefined : inherited?.show,
      items: undefined,
      nestedRoutes: undefined
    } satisfies LmsNavItemConfig;
  });
}

/** True when an org settings tab is part of V1. */
export function isOrgSettingsTabVisible(href: string): boolean {
  return ORG_SETTINGS_TABS_V1.includes(href);
}

/** True when a course workspace tab is part of V1. */
export function isCourseNavItemVisible(id: string): boolean {
  return !CELLULOPLAST_HIDDEN_COURSE_NAV_IDS.includes(id);
}
