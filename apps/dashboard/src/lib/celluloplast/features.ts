/**
 * Celluloplast Academy V1 scope flags (fork layer).
 *
 * ClassroomIO ships surfaces the internal academy does not use: community, AI, marketplace
 * widgets, billing/plans, multi-organization, automation. V1 hides them in the UI instead of
 * deleting upstream code, so the fork stays rebaseable on ClassroomIO. Flip a flag back to
 * `true` to restore a surface — the underlying routes and API are untouched.
 *
 * The navigation allowlists live in `./navigation`; these flags cover the surfaces that are
 * rendered outside the nav configs (sidebar footer, org switcher, LMS dashboard sections).
 */
export const CELLULOPLAST_V1 = {
  /** One internal organization: no org switcher, no "add organization" modal. */
  multiOrganization: false,
  /** Polar billing, plan badges, upgrade triggers and paid-plan markers. */
  billing: false,
  /** AI course builder, AI lesson tutor, AI credits. */
  ai: false,
  /** Community Q&A. */
  community: false,
  /** Public catalog browsing for learners — V1 is assignment-only. */
  exploreCatalog: false,
  /** Embeddable widgets, public API, MCP, Zapier. */
  automation: false,
  /** Cohorts (multi-course programs) — reassess in V1.1. */
  cohorts: false
} as const;
