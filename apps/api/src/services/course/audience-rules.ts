import type { TCourseAudienceAssignment } from '@cio/utils/validation/course/course';

/**
 * Who a course is for, and what a direct grant means against that rule.
 *
 * Kept free of database imports so the rules can be exercised on their own — the assignment
 * service they serve reaches into enrolment, email and org queries.
 */
export type TAudienceAssignmentMember = {
  memberId: number;
  profileId: string | null;
  email: string;
  jobTitle?: string | null;
  department?: string | null;
};

export function memberMatchesAssignment(
  member: Pick<TAudienceAssignmentMember, 'memberId' | 'jobTitle' | 'department'>,
  assignment: TCourseAudienceAssignment
): boolean {
  switch (assignment.mode) {
    case 'all':
      return true;
    case 'members':
      return (assignment.memberIds ?? []).includes(member.memberId);
    case 'jobTitles': {
      const memberTitle = member.jobTitle?.toLowerCase().trim() ?? '';
      if (!memberTitle) {
        return false;
      }

      const titles = (assignment.jobTitles ?? []).map((title) => title.toLowerCase().trim());
      return titles.includes(memberTitle);
    }
    case 'departments': {
      const memberDepartment = member.department?.toLowerCase().trim() ?? '';
      if (!memberDepartment) {
        return false;
      }

      const departments = (assignment.departments ?? []).map((department) => department.toLowerCase().trim());
      return departments.includes(memberDepartment);
    }
    default:
      return false;
  }
}

/**
 * What a direct, per-person assignment means for a course whose audience is rule-based.
 *
 * - `allowed`: the member already satisfies the course's rule, so enrolling them is coherent.
 * - `addToMemberList`: the course targets an explicit list of people, which is exactly the
 *   per-employee case — the member joins that list so the model records the grant instead of
 *   leaving a detached enrolment the rule knows nothing about.
 * - `refused`: the course targets a department or a job title the member is not in. Granting
 *   access here would contradict the rule that governs the course.
 */
export type DirectAssignmentOutcome = 'allowed' | 'addToMemberList' | 'refused';

export function resolveDirectAssignment(
  member: Pick<TAudienceAssignmentMember, 'memberId' | 'jobTitle' | 'department'>,
  assignment: TCourseAudienceAssignment
): DirectAssignmentOutcome {
  if (memberMatchesAssignment(member, assignment)) {
    return 'allowed';
  }

  return assignment.mode === 'members' ? 'addToMemberList' : 'refused';
}
