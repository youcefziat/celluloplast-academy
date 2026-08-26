/**
 * Celluloplast Academy V1 authoring policy (fork layer).
 *
 * Keeps course creation/editing simple for internal HR/admin/tutor use without
 * rewriting ClassroomIO's course engine. Upstream routes and tables stay as-is;
 * this module centralizes defaults, content filters, and UI gates.
 */

import { CELLULOPLAST_V1 } from './features';
import { NAV_IDS } from '$features/course/components/sidebar/constants';
import { ContentType } from '@cio/utils/constants/content';
import type { TCourseType } from '@cio/db/types';

/** Course types offered in the create-formation flow. */
export const CELLULOPLAST_COURSE_TYPES = ['SELF_PACED'] as const satisfies readonly TCourseType[];

export type CelluloplastCourseType = (typeof CELLULOPLAST_COURSE_TYPES)[number];

export const CELLULOPLAST_AUTHORING = {
  /** Default (and only) type for new formations in V1. */
  defaultCourseType: 'SELF_PACED' as CelluloplastCourseType,
  /** Creation flow stays upstream-admin only in V1. */
  creationRole: 'ADMIN_ONLY' as const,
  /** Skip ClassroomIO's type-picker step; always use defaultCourseType. */
  skipCourseTypeStep: true,
  /**
   * Applied right after create via PUT (create payload has no certificate field).
   * Threshold 100 = certificate when the formation is fully completed.
   */
  defaultCertificate: {
    isDownloadable: true,
    threshold: 100
  },
  /** Content types kept in the add-content picker. */
  allowedContentTypes: [ContentType.Section, ContentType.Lesson, ContentType.Exercise] as const,
  /** Where to land after creating a formation. */
  afterCreatePath: (courseId: string) => `/courses/${courseId}/lessons` as const,
  /** Deep-link to assign learners (upstream InvitationModal). */
  assignPeoplePath: (courseId: string) => `/courses/${courseId}/people?add=true` as const,
  /** Course settings publish anchor. */
  publishSettingsPath: (courseId: string) => `/courses/${courseId}/settings#publish` as const,
  /**
   * Visible settings in the simplified V1 screen.
   * Hidden upstream fields still exist in the data model and API.
   */
  visibleSettings: {
    coverImage: true,
    title: true,
    description: true,
    certificateEnabled: true,
    publication: true,
    assignment: true,
    deletion: true
  }
} as const;

/** Course sidebar tabs hidden in V1. */
export const CELLULOPLAST_HIDDEN_COURSE_NAV_IDS: string[] = [
  NAV_IDS.AI_ASSISTANT,
  NAV_IDS.LANDING_PAGE,
  // Newsfeed is social; community is out of V1.
  NAV_IDS.NEWS_FEED
];

/** True when any AI authoring/assistant UI may render. */
export function isCelluloplastAiUiEnabled(): boolean {
  return CELLULOPLAST_V1.ai;
}

export function isCelluloplastCourseTypeAllowed(type: TCourseType): boolean {
  return (CELLULOPLAST_COURSE_TYPES as readonly string[]).includes(type);
}

export function filterCelluloplastContentOptions<T extends { type: ContentType }>(options: readonly T[]): T[] {
  const allowed = new Set<ContentType>(CELLULOPLAST_AUTHORING.allowedContentTypes);

  return options.filter((option) => allowed.has(option.type));
}
