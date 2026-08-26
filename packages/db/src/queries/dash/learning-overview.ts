import * as schema from '@db/schema';

import { ROLE } from '@cio/utils/constants';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';

import { db } from '@db/drizzle';
import { isExerciseCompletedSql } from '../course/progression';

export type OrgLearningOverviewRow = {
  groupMemberId: string;
  profileId: string;
  fullname: string | null;
  email: string | null;
  avatarUrl: string | null;
  courseId: string;
  courseTitle: string;
  courseType: string | null;
  lessonsTotal: number;
  lessonsCompleted: number;
  exercisesTotal: number;
  exercisesCompleted: number;
  certificateEarnedAt: string | null;
  lastActivityAt: string | null;
};

export type GetOrgLearningOverviewRowsOptions = {
  /**
   * When set (tutor), only return enrollments for courses where this profile
   * is a group member — same scoping as `getOrgCourses({ profileId })`.
   */
  tutorProfileId?: string;
};

/**
 * One row per enrolled student × course for an organization.
 * No filter on `course.type` — SELF_PACED, COMPLIANCE and other types are included.
 * Progress counts match `getCourseProgress` / `calcCourseProgressPercent`.
 */
export async function getOrgLearningOverviewRows(
  orgId: string,
  options: GetOrgLearningOverviewRowsOptions = {}
): Promise<OrgLearningOverviewRow[]> {
  try {
    const { tutorProfileId } = options;

    const conditions = [
      eq(schema.group.organizationId, orgId),
      eq(schema.course.status, 'ACTIVE'),
      eq(schema.groupmember.roleId, ROLE.STUDENT),
      isNotNull(schema.groupmember.profileId)
    ];

    if (tutorProfileId) {
      conditions.push(
        sql`EXISTS (
          SELECT 1
          FROM ${schema.groupmember} AS tutor_member
          WHERE tutor_member.group_id = ${schema.group.id}
            AND tutor_member.profile_id = ${tutorProfileId}
        )`
      );
    }

    const result = await db
      .select({
        groupMemberId: schema.groupmember.id,
        profileId: schema.groupmember.profileId,
        fullname: schema.profile.fullname,
        email: schema.profile.email,
        avatarUrl: schema.profile.avatarUrl,
        courseId: schema.course.id,
        courseTitle: schema.course.title,
        courseType: schema.course.type,
        certificateEarnedAt: schema.groupmember.certificateEarnedAt,
        lessonsTotal: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${schema.lesson} AS l
          WHERE l.course_id = ${schema.course.id}
        )`.as('lessons_total'),
        lessonsCompleted: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${schema.lessonCompletion} AS lc
          INNER JOIN ${schema.lesson} AS l ON l.id = lc.lesson_id
          WHERE l.course_id = ${schema.course.id}
            AND lc.profile_id = ${schema.groupmember.profileId}
            AND lc.is_complete = true
        )`.as('lessons_completed'),
        exercisesTotal: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${schema.exercise} AS ex
          LEFT JOIN ${schema.lesson} AS el ON el.id = ex.lesson_id
          WHERE ex.course_id = ${schema.course.id}
             OR el.course_id = ${schema.course.id}
        )`.as('exercises_total'),
        exercisesCompleted: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${schema.exercise} AS ex
          LEFT JOIN ${schema.lesson} AS el ON el.id = ex.lesson_id
          WHERE (ex.course_id = ${schema.course.id} OR el.course_id = ${schema.course.id})
            AND ${isExerciseCompletedSql('ex', {
              // Correlated to the outer enrollment row (same pattern as getCourseProgress).
              groupMemberId: schema.groupmember.id as unknown as string
            })}
        )`.as('exercises_completed'),
        lastActivityAt: sql<string | null>`(
          SELECT MAX(lc.updated_at)
          FROM ${schema.lessonCompletion} AS lc
          INNER JOIN ${schema.lesson} AS l ON l.id = lc.lesson_id
          WHERE l.course_id = ${schema.course.id}
            AND lc.profile_id = ${schema.groupmember.profileId}
        )`.as('last_activity_at')
      })
      .from(schema.course)
      .innerJoin(schema.group, eq(schema.group.id, schema.course.groupId))
      .innerJoin(schema.groupmember, eq(schema.groupmember.groupId, schema.group.id))
      .leftJoin(schema.profile, eq(schema.profile.id, schema.groupmember.profileId))
      .where(and(...conditions))
      .orderBy(asc(schema.profile.fullname), asc(schema.course.title));

    return result.map((row) => ({
      groupMemberId: row.groupMemberId,
      profileId: row.profileId!,
      fullname: row.fullname ?? null,
      email: row.email ?? null,
      avatarUrl: row.avatarUrl ?? null,
      courseId: row.courseId,
      courseTitle: row.courseTitle,
      courseType: row.courseType ?? null,
      lessonsTotal: Number(row.lessonsTotal) || 0,
      lessonsCompleted: Number(row.lessonsCompleted) || 0,
      exercisesTotal: Number(row.exercisesTotal) || 0,
      exercisesCompleted: Number(row.exercisesCompleted) || 0,
      certificateEarnedAt: row.certificateEarnedAt ?? null,
      lastActivityAt: row.lastActivityAt ?? null
    }));
  } catch (error) {
    console.error('getOrgLearningOverviewRows error:', error);
    throw new Error(
      `Failed to get org learning overview rows: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
