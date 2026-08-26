/**
 * Celluloplast Academy V1 learner LMS policy (fork layer).
 *
 * Keeps the student journey to: home → my trainings → continue → certificate.
 * Upstream LMS routes and APIs stay intact; this module gates presentation only.
 */

import { getStudentCourseProgressPercent, isStudentCourseComplete } from '$features/course/utils/compliance-utils';
import type { UserEnrolledCourses } from '$features/course/types';

export const CELLULOPLAST_LMS = {
  /** Hide SaaS-style aggregate stats (streak, compliance score, global %). */
  showActivityStats: false,
  /** Hide live-class upcoming sessions card on the home. */
  showUpcomingSessions: false,
  /** Hide public-course quick links on learner cards. */
  showPublicCourseLinks: false,
  /** Show a certificates summary block on the LMS home. */
  showCertificatesSummary: true
} as const;

export type CelluloplastLmsTrainingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export function isCelluloplastLmsSimplified(): boolean {
  return true;
}

export function getCelluloplastLmsTrainingStatus(course: UserEnrolledCourses[number]): CelluloplastLmsTrainingStatus {
  if (isStudentCourseComplete(course)) {
    return 'COMPLETED';
  }

  if (getStudentCourseProgressPercent(course) <= 0) {
    return 'NOT_STARTED';
  }

  return 'IN_PROGRESS';
}

/** Primary CTA key for an enrolled training card. */
export function getCelluloplastLmsActionKey(course: UserEnrolledCourses[number]): string {
  const status = getCelluloplastLmsTrainingStatus(course);

  if (status === 'COMPLETED') {
    return 'celluloplast_lms.review';
  }

  if (status === 'NOT_STARTED') {
    return 'celluloplast_lms.start';
  }

  return 'celluloplast_lms.continue';
}

export function getCelluloplastLmsStatusKey(status: CelluloplastLmsTrainingStatus): string {
  return `celluloplast_lms.status.${status}`;
}

/**
 * Sort for Mes formations: in progress → not started → completed.
 * Stable enough for V1 without a new API.
 */
export function sortCelluloplastLmsTrainings(courses: UserEnrolledCourses): UserEnrolledCourses {
  const rank: Record<CelluloplastLmsTrainingStatus, number> = {
    IN_PROGRESS: 0,
    NOT_STARTED: 1,
    COMPLETED: 2
  };

  return [...courses].sort((left, right) => {
    const leftStatus = getCelluloplastLmsTrainingStatus(left);
    const rightStatus = getCelluloplastLmsTrainingStatus(right);
    const byStatus = rank[leftStatus] - rank[rightStatus];

    if (byStatus !== 0) {
      return byStatus;
    }

    return getStudentCourseProgressPercent(right) - getStudentCourseProgressPercent(left);
  });
}

export function filterCelluloplastLmsByStatus(
  courses: UserEnrolledCourses,
  status: CelluloplastLmsTrainingStatus
): UserEnrolledCourses {
  return courses.filter((course) => getCelluloplastLmsTrainingStatus(course) === status);
}
