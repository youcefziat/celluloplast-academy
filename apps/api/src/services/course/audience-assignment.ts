import { AppError, ErrorCodes } from '@api/utils/errors';
import { enrollAudienceStudentProfilesInCourses } from '@api/services/organization/audience';
import { getCourseById, getOrgCourseGroups, getPublishedCoursesWithAudienceAssignment } from '@cio/db/queries/course';
import {
  getOrganizationById,
  getOrganizationMembersForAudienceAssignment,
  type TOrganizationMemberForAudienceAssignment
} from '@cio/db/queries/organization';
import { appendCourseIdsToPendingAudienceInvites } from '@cio/db/queries/organization/invite';
import type { TCourseAudienceAssignment } from '@cio/utils/validation/course/course';
import { memberMatchesAssignment, type TAudienceAssignmentMember } from './audience-rules';

export {
  memberMatchesAssignment,
  resolveDirectAssignment,
  type DirectAssignmentOutcome,
  type TAudienceAssignmentMember
} from './audience-rules';

export async function resolveMembersForAssignment(
  orgId: string,
  assignment: TCourseAudienceAssignment
): Promise<{
  members: TOrganizationMemberForAudienceAssignment[];
  profileIds: string[];
  pendingEmails: string[];
}> {
  const members = await getOrganizationMembersForAudienceAssignment(orgId, {
    mode: assignment.mode,
    memberIds: assignment.memberIds,
    jobTitles: assignment.jobTitles,
    departments: assignment.departments
  });

  const profileIds = members.map((member) => member.profileId).filter((profileId): profileId is string => !!profileId);
  const pendingEmails = members.filter((member) => !member.profileId && member.email).map((member) => member.email);

  return { members, profileIds, pendingEmails };
}

export async function syncCourseAudienceAssignment(
  orgId: string,
  courseId: string,
  assignment: TCourseAudienceAssignment
): Promise<{ assigned: number; alreadyEnrolled: number; pendingUpdated: number; emailsSent: number }> {
  const organization = await getOrganizationById(orgId);
  if (!organization) {
    throw new AppError('Organization not found', ErrorCodes.ORGANIZATION_NOT_FOUND, 404);
  }

  const [course] = await getCourseById(courseId);
  if (!course || !course.isPublished) {
    return { assigned: 0, alreadyEnrolled: 0, pendingUpdated: 0, emailsSent: 0 };
  }

  const courseGroups = await getOrgCourseGroups(orgId, [courseId]);
  if (courseGroups.length === 0) {
    throw new AppError('Course not found in organization', ErrorCodes.COURSE_NOT_FOUND, 404);
  }

  const { profileIds, pendingEmails } = await resolveMembersForAssignment(orgId, assignment);
  const shouldSendEmail = assignment.sendEmail ?? true;

  const enrollmentResult = await enrollAudienceStudentProfilesInCourses(
    orgId,
    organization,
    profileIds,
    [courseId],
    shouldSendEmail
  );

  const pendingUpdated = await appendCourseIdsToPendingAudienceInvites(orgId, pendingEmails, [courseId]);

  return {
    assigned: enrollmentResult.assigned,
    alreadyEnrolled: enrollmentResult.alreadyEnrolled,
    pendingUpdated,
    emailsSent: enrollmentResult.emailsSent
  };
}

export async function syncMemberToMatchingPublishedCourses(
  orgId: string,
  member: TAudienceAssignmentMember
): Promise<{ coursesSynced: number; assigned: number }> {
  const organization = await getOrganizationById(orgId);
  if (!organization) {
    return { coursesSynced: 0, assigned: 0 };
  }

  const publishedCourses = await getPublishedCoursesWithAudienceAssignment(orgId);
  const matchingCourses = publishedCourses.filter((course) =>
    memberMatchesAssignment(member, course.audienceAssignment)
  );

  if (matchingCourses.length === 0) {
    return { coursesSynced: 0, assigned: 0 };
  }

  let assigned = 0;
  let coursesSynced = 0;

  for (const course of matchingCourses) {
    const shouldSendEmail = course.audienceAssignment.sendEmail ?? true;

    if (member.profileId) {
      const enrollmentResult = await enrollAudienceStudentProfilesInCourses(
        orgId,
        organization,
        [member.profileId],
        [course.id],
        shouldSendEmail
      );
      assigned += enrollmentResult.assigned;
      coursesSynced++;
      continue;
    }

    if (member.email) {
      const pendingUpdated = await appendCourseIdsToPendingAudienceInvites(orgId, [member.email], [course.id]);
      if (pendingUpdated > 0) {
        coursesSynced++;
      }
    }
  }

  return { coursesSynced, assigned };
}

export function audienceAssignmentChanged(
  previous: TCourseAudienceAssignment | undefined | null,
  next: TCourseAudienceAssignment | undefined | null
): boolean {
  return JSON.stringify(previous ?? null) !== JSON.stringify(next ?? null);
}
