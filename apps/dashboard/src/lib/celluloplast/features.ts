/**
 * Celluloplast Academy V1 scope flags (fork layer).
 *
 * Most of ClassroomIO's out-of-scope surfaces (AI, community, cohorts, widgets, automation,
 * billing, the public academy) were deleted in the 2026-08 cleanup — see
 * `docs/celluloplast/CLEANUP_AUDIT.md`. What remains here are the two switches that still
 * gate live code paths rather than a deleted surface.
 */
export const CELLULOPLAST_V1 = {
  /** One internal organization: no org switcher, no cross-org role resolution. */
  multiOrganization: false,
  /**
   * Public catalog browsing for learners — V1 is assignment-only. The catalog routes are gone;
   * this flag still guards the org-context and landing redirects that reference `/courses`.
   */
  exploreCatalog: false
} as const;
