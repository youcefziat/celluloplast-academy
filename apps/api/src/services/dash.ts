import { AppError, ErrorCodes } from '@api/utils/errors';
import { env } from '@cio/core/config/env';
import {
  getCourseStats,
  getDashOrgStats,
  getOrgLearningOverviewRows,
  getOrgStudentLoginsByDayOfWeek,
  getUserLoginStreak,
  getRecentCertifications,
  getTotalCertificatesIssued
} from '@cio/db/queries/dash';
import { dashLoginActivityKey } from '@api/utils/redis/key-generators';
import { logRedisUnavailableOnce, redis } from '@cio/core/utils/redis/redis';
import {
  invalidateOrgStats,
  readOrgStatsVersionAndCache,
  writeOrgStatsCache
} from '@cio/core/utils/redis/org-stats-cache';
import { calcCourseProgressPercent } from '@api/utils/course-completion';
import { ROLE } from '@cio/utils/constants';

import type { OrganisationAnalytics } from '@api/types';
import { getOrgIdBySiteName } from '@cio/db/queries';

async function loadOrganisationAnalyticsFromDatabase(orgId: string): Promise<OrganisationAnalytics> {
  const [stats, topCourses, recentCertificationRows, certificateCountRows] = await Promise.all([
    getDashOrgStats(orgId),
    getCourseStats(orgId),
    getRecentCertifications(orgId),
    getTotalCertificatesIssued(orgId)
  ]);

  const analytics: OrganisationAnalytics = {
    totalCertificates: certificateCountRows[0]?.count ?? 0,
    numberOfCourses: stats?.[0]?.noOfCourses ?? 0,
    totalStudents: stats?.[0]?.enrolledStudents ?? 0,
    topCourses: topCourses.map((course) => ({
      id: course.courseId,
      title: course.courseTitle,
      enrollments: course.totalStudents,
      completion: course.completionPercentage,
      certification: course.certificationPercentage
    })),
    recentCertifications: recentCertificationRows.map((row) => ({
      id: row.profileId,
      avatarUrl: row.avatarUrl,
      name: row.fullname,
      courseId: row.courseId,
      course: row.courseTitle,
      date: row.earnedAt ?? ''
    }))
  };

  return analytics;
}

export async function getOrganisationAnalytics(
  orgId?: string,
  siteName?: string,
  bustCache = false
): Promise<OrganisationAnalytics> {
  let resolvedOrgId = orgId;

  if (!resolvedOrgId && siteName) {
    const [org] = await getOrgIdBySiteName(siteName);

    if (org) {
      resolvedOrgId = org.id;
    } else {
      throw new AppError('Organization not found for the given site name', ErrorCodes.ORG_NOT_FOUND, 404);
    }
  }

  if (!resolvedOrgId) {
    throw new AppError('Organization not found', ErrorCodes.ORG_NOT_FOUND, 404);
  }

  try {
    const { version, data: cached } = await readOrgStatsVersionAndCache<OrganisationAnalytics>(resolvedOrgId);

    if (!bustCache && cached) {
      return cached;
    }

    const analytics = await loadOrganisationAnalyticsFromDatabase(resolvedOrgId);
    await writeOrgStatsCache(resolvedOrgId, version, analytics);

    return analytics;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error('Failed to load organisation analytics:', error);
    throw new AppError('Failed to load organisation analytics', ErrorCodes.ORG_ANALYTICS_FETCH_FAILED, 500);
  }
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type StudentLoginActivityRow = { day: string; count: number };

/** Redis TTL for login-activity chart payload (1 day). */
const LOGIN_ACTIVITY_CACHE_TTL_SECONDS = 86_400;

function parseLoginActivityCache(raw: string): StudentLoginActivityRow[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== 7) {
    return null;
  }

  const out: StudentLoginActivityRow[] = [];
  for (const item of parsed) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('day' in item) ||
      !('count' in item) ||
      typeof (item as { day: unknown }).day !== 'string' ||
      typeof (item as { count: unknown }).count !== 'number' ||
      !Number.isInteger((item as { count: number }).count) ||
      (item as { count: number }).count < 0
    ) {
      return null;
    }

    out.push({ day: (item as { day: string }).day, count: (item as { count: number }).count });
  }

  for (const label of DAY_LABELS) {
    if (!out.some((r) => r.day === label)) {
      return null;
    }
  }

  return out;
}

/** Day-of-week login chart; results cached in Redis (24h TTL) when `REDIS_URL` is set. */
export async function getStudentLoginActivity(orgId: string, days: number): Promise<StudentLoginActivityRow[]> {
  const cacheKey = dashLoginActivityKey(orgId, days);

  if (env.REDIS_URL) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const rows = parseLoginActivityCache(cached);
        if (rows) {
          return rows;
        }
      }
    } catch (error) {
      logRedisUnavailableOnce('Redis get failed for login activity cache, using database', error);
    }
  }

  try {
    const rows = await getOrgStudentLoginsByDayOfWeek(orgId, days);

    const countByDow = new Map(rows.map((r) => [r.dayOfWeek, r.count]));

    const result = DAY_LABELS.map((label, index) => ({
      day: label,
      count: countByDow.get(index) ?? 0
    }));

    if (env.REDIS_URL) {
      try {
        await redis.setEx(cacheKey, LOGIN_ACTIVITY_CACHE_TTL_SECONDS, JSON.stringify(result));
      } catch (error) {
        logRedisUnavailableOnce('Redis set failed for login activity cache, continuing', error);
      }
    }

    return result;
  } catch (error) {
    console.error('getStudentLoginActivity error:', error);
    throw new AppError('Failed to load login activity', ErrorCodes.ORG_ANALYTICS_FETCH_FAILED, 500);
  }
}

export async function getCurrentUserLoginStreak(userId: string) {
  try {
    return await getUserLoginStreak(userId);
  } catch (error) {
    console.error('getCurrentUserLoginStreak error:', error);
    throw new AppError('Failed to load login streak', ErrorCodes.ORG_ANALYTICS_FETCH_FAILED, 500);
  }
}

export type LearningProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type OrgLearningOverviewLearner = {
  groupMemberId: string;
  profileId: string;
  fullname: string | null;
  email: string | null;
  avatarUrl: string | null;
  courseId: string;
  courseTitle: string;
  courseType: string | null;
  progressPercent: number;
  lessonsCompleted: number;
  lessonsTotal: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  status: LearningProgressStatus;
  lastActivityAt: string | null;
  certificateEarnedAt: string | null;
};

export type OrgLearningOverviewCourse = {
  courseId: string;
  courseTitle: string;
  courseType: string | null;
  learnerCount: number;
};

export type OrgLearningOverview = {
  learners: OrgLearningOverviewLearner[];
  courses: OrgLearningOverviewCourse[];
};

function deriveLearningProgressStatus(progressPercent: number): LearningProgressStatus {
  if (progressPercent >= 100) {
    return 'COMPLETED';
  }

  if (progressPercent > 0) {
    return 'IN_PROGRESS';
  }

  return 'NOT_STARTED';
}

/**
 * Org-wide learner × course progress for ACTIVE courses of any type.
 * Tutors only see courses where they are a group member.
 */
export async function getOrgLearningOverview(
  orgId: string,
  viewer: { userId: string; roleId: number }
): Promise<OrgLearningOverview> {
  try {
    const tutorProfileId = viewer.roleId === ROLE.TUTOR ? viewer.userId : undefined;
    const rows = await getOrgLearningOverviewRows(orgId, { tutorProfileId });

    const courseMap = new Map<string, OrgLearningOverviewCourse>();
    const learners: OrgLearningOverviewLearner[] = [];

    for (const row of rows) {
      const progressPercent = calcCourseProgressPercent({
        lessonsCompleted: row.lessonsCompleted,
        totalLessons: row.lessonsTotal,
        exercisesCompleted: row.exercisesCompleted,
        exercisesCount: row.exercisesTotal
      });

      learners.push({
        groupMemberId: row.groupMemberId,
        profileId: row.profileId,
        fullname: row.fullname,
        email: row.email,
        avatarUrl: row.avatarUrl,
        courseId: row.courseId,
        courseTitle: row.courseTitle,
        courseType: row.courseType,
        progressPercent,
        lessonsCompleted: row.lessonsCompleted,
        lessonsTotal: row.lessonsTotal,
        exercisesCompleted: row.exercisesCompleted,
        exercisesTotal: row.exercisesTotal,
        status: deriveLearningProgressStatus(progressPercent),
        lastActivityAt: row.lastActivityAt,
        certificateEarnedAt: row.certificateEarnedAt
      });

      const existingCourse = courseMap.get(row.courseId);

      if (existingCourse) {
        existingCourse.learnerCount += 1;
      } else {
        courseMap.set(row.courseId, {
          courseId: row.courseId,
          courseTitle: row.courseTitle,
          courseType: row.courseType,
          learnerCount: 1
        });
      }
    }

    return {
      learners,
      courses: Array.from(courseMap.values()).sort((a, b) => a.courseTitle.localeCompare(b.courseTitle))
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error('getOrgLearningOverview error:', error);
    throw new AppError('Failed to load learning overview', ErrorCodes.ORG_ANALYTICS_FETCH_FAILED, 500);
  }
}

export { invalidateOrgStats };
