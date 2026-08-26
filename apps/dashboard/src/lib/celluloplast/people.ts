/**
 * Celluloplast Academy V1 people / assignment policy (fork layer).
 *
 * Reuses ClassroomIO enrollment (`organization.audience.assign-courses` and
 * course members APIs) while presenting a simple "assign employees" UX.
 */

export const CELLULOPLAST_PEOPLE = {
  /**
   * Tutors are managed from org Administration, not from the formation invite modal.
   */
  showTutorInviteTab: false,
  /**
   * Bulk email / invite-by-CSV creates org audience invites — out of V1 scope.
   * Existing employees are assigned via multi-select instead.
   */
  showBulkEmailInvite: false,
  /** Role filter (Admin/Tutor/Student) is ClassroomIO jargon for V1. */
  showRoleFilter: false,
  /** List only learners on the formation people page. */
  listStudentsOnly: true,
  /**
   * Upstream DELETE /members hard-deletes the groupmember row (progress +
   * certificate_earned_at). Do not expose "remove" until a safe soft-path exists.
   */
  showMemberRemoval: false,
  /** Show assignment date from groupmember.createdAt. */
  showAssignedAtColumn: true
} as const;

export function isCelluloplastPeopleSimplified(): boolean {
  return true;
}
