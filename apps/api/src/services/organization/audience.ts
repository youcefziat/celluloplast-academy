import { AppError, ErrorCodes } from '@api/utils/errors';
import type {
  TAssignAudienceCourses,
  TAudienceImportRow,
  TAudienceInviteByEmail,
  TCreateAudienceMember,
  TImportAudienceMembers,
  TUpdateAudienceMember
} from '@cio/utils/validation/organization';
import { addGroupMembers, enrollUsersInCourseGroups, getExistingGroupMembers } from '@cio/db/queries/group';
import { invalidateOrgStats } from '@cio/core/utils/redis/org-stats-cache';
import { buildEmailFromName, buildEmailBranding } from '@cio/email';
import { enqueueTransactionalEmail } from '@api/services/jobs';
import { addCohortMember, getExistingCohortMembers, getCohortsByOrg } from '@cio/db/queries/cohort';
import {
  createOrganizationInvite,
  createOrganizationInviteAudits,
  createOrganizationInvites,
  createOrganizationMembers,
  getOrganizationAudienceMember,
  getLatestOrganizationInviteRowByOrgAndEmail,
  getOrgMembersByProfileIds,
  getOrganizationById,
  getOrganizationDepartmentById,
  getOrganizationDepartmentByName,
  getOrganizationMembersByNormalizedEmails,
  getOrganizationPositionById,
  getOrganizationPositionByName,
  getStudentOrganizationMemberByOrgAndEmail,
  hasActiveOrganizationInviteForEmail,
  revokeActiveOrganizationInvitesByEmails
} from '@cio/db/queries/organization';
import {
  getCourseById,
  getCourseGroupIds,
  getOrgCourseGroups,
  getOrgCourses,
  getPublishedCoursesWithAudienceAssignment,
  updateCourse
} from '@cio/db/queries/course';
import { countOrganizationMembersByRole, updateOrganizationAudienceMember } from '@cio/db/queries/organization';

import { ROLE } from '@cio/utils/constants';
import crypto from 'node:crypto';
import { getDashboardBaseUrl } from '@cio/core/config/dashboard-url';
import { assertStudentCapacityOrThrow } from './student-limit';
import { getProfilesByEmails } from '@cio/db/queries/auth';
import { ensureComplianceEnrollmentRecordsForProfiles } from '../course/compliance';
import { getWelcomeSessionIcs } from '../course/session-invite';
import { resolveDirectAssignment, syncMemberToMatchingPublishedCourses } from '../course/audience-assignment';
import type { TCourseAudienceAssignment } from '@cio/utils/validation/course/course';
import type { TCourse } from '@cio/db/types';
import { buildDeliveryEmailOverrides } from './invite-delivery';
import { sendStaffOrgInvite } from './invite';
import { assertRoleChangeAllowed } from './role-rules';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORG_INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
/** Parallel outbound invite emails; avoids sequential SMTP/API latency per recipient. */
const EMAIL_SEND_CONCURRENCY = 5;

type ResolvedHrRefs = {
  positionId: number | null;
  departmentId: number | null;
};

async function resolveAudienceHrRefs(
  orgId: string,
  input: {
    positionId?: number;
    departmentId?: number;
    jobTitle?: string;
    department?: string;
  }
): Promise<{ refs: ResolvedHrRefs; error?: string }> {
  let positionId: number | null = null;
  let departmentId: number | null = null;

  if (input.positionId) {
    const position = await getOrganizationPositionById(orgId, input.positionId);
    if (!position) {
      return {
        refs: { positionId: null, departmentId: null },
        error: `Poste introuvable (id ${input.positionId})`
      };
    }
    positionId = position.id;
  } else if (input.jobTitle) {
    const position = await getOrganizationPositionByName(orgId, input.jobTitle);
    if (!position) {
      return {
        refs: { positionId: null, departmentId: null },
        error: `Poste "${input.jobTitle}" introuvable. Créez-le d'abord dans Administration > Postes.`
      };
    }
    positionId = position.id;
  }

  if (input.departmentId) {
    const department = await getOrganizationDepartmentById(orgId, input.departmentId);
    if (!department) {
      return {
        refs: { positionId: null, departmentId: null },
        error: `Département introuvable (id ${input.departmentId})`
      };
    }
    departmentId = department.id;
  } else if (input.department) {
    const department = await getOrganizationDepartmentByName(orgId, input.department);
    if (!department) {
      return {
        refs: { positionId: null, departmentId: null },
        error: `Département "${input.department}" introuvable. Créez-le d'abord dans Administration > Départements.`
      };
    }
    departmentId = department.id;
  }

  return { refs: { positionId, departmentId } };
}

function audienceMemberHrStrings(member: {
  jobTitle?: string | null;
  position?: { id: number; name: string } | null;
  department?: { id: number; name: string } | null;
}) {
  return {
    jobTitle: member.jobTitle ?? member.position?.name ?? null,
    department: member.department?.name ?? null
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function buildInviteLink(
  token: string,
  org?: { siteName?: string | null; customDomain?: string | null; isCustomDomainVerified?: boolean | null }
): string {
  return `${getDashboardBaseUrl(org)}/invite/${encodeURIComponent(token)}`;
}

function getExpiryLabel(expiresAtIso: string): string {
  return new Date(expiresAtIso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  });
}

function parseRecipientCsv(recipientCsv: string): string[] {
  return recipientCsv
    .split(/[\n,;\t ]+/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getNormalizedRecipients(recipientCsv: string): {
  valid: string[];
  invalid: string[];
  duplicates: string[];
} {
  const raw = parseRecipientCsv(recipientCsv);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];

  for (const recipient of raw) {
    const normalized = recipient.toLowerCase().trim();
    if (!normalized) continue;

    if (!EMAIL_REGEX.test(normalized)) {
      invalid.push(normalized);
      continue;
    }

    if (seen.has(normalized)) {
      duplicates.push(normalized);
      continue;
    }

    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid, duplicates };
}

function normalizeImportRows(data: TImportAudienceMembers): {
  rows: TAudienceImportRow[];
  duplicates: string[];
  invalid: string[];
} {
  if (data.rows && data.rows.length > 0) {
    const seen = new Set<string>();
    const rows: TAudienceImportRow[] = [];
    const duplicates: string[] = [];
    const invalid: string[] = [];

    for (const row of data.rows) {
      const email = row.email.toLowerCase().trim();
      if (!EMAIL_REGEX.test(email)) {
        invalid.push(email);
        continue;
      }

      if (seen.has(email)) {
        duplicates.push(email);
        continue;
      }

      seen.add(email);

      const managerEmail = row.managerEmail?.toLowerCase().trim();
      if (managerEmail && !EMAIL_REGEX.test(managerEmail)) {
        invalid.push(managerEmail);
      }

      rows.push({
        ...row,
        email,
        managerEmail: managerEmail && EMAIL_REGEX.test(managerEmail) ? managerEmail : undefined
      });
    }

    return { rows, duplicates, invalid };
  }

  const recipients = getNormalizedRecipients(data.recipientCsv ?? '');
  return {
    rows: recipients.valid.map(
      (email): TAudienceImportRow => ({
        email,
        firstName: undefined,
        lastName: undefined,
        jobTitle: undefined,
        department: undefined,
        managerEmail: undefined
      })
    ),
    duplicates: recipients.duplicates,
    invalid: recipients.invalid
  };
}

async function resolveManagerMemberId(
  orgId: string,
  options: { managerMemberId?: number; managerEmail?: string }
): Promise<{ managerMemberId: number | undefined; warning?: string }> {
  if (options.managerMemberId) {
    const manager = await getOrganizationAudienceMember(orgId, options.managerMemberId);
    if (!manager) {
      return { managerMemberId: undefined, warning: `Manager member ${options.managerMemberId} not found` };
    }

    return { managerMemberId: options.managerMemberId };
  }

  if (!options.managerEmail) {
    return { managerMemberId: undefined };
  }

  const normalizedManagerEmail = options.managerEmail.toLowerCase().trim();
  const managers = await getOrganizationMembersByNormalizedEmails(orgId, [normalizedManagerEmail]);
  const manager = managers[0];

  if (!manager) {
    return {
      managerMemberId: undefined,
      warning: `Manager email not found: ${normalizedManagerEmail}`
    };
  }

  return { managerMemberId: manager.id };
}

async function linkManagerMembersByEmail(
  orgId: string,
  pairs: Array<{ memberEmail: string; managerEmail?: string }>
): Promise<string[]> {
  const warnings: string[] = [];
  const managerEmails = [
    ...new Set(pairs.map((pair) => pair.managerEmail?.toLowerCase().trim()).filter(Boolean) as string[])
  ];

  if (managerEmails.length === 0) {
    return warnings;
  }

  const memberEmails = [...new Set(pairs.map((pair) => pair.memberEmail.toLowerCase().trim()))];
  const allEmails = [...new Set([...memberEmails, ...managerEmails])];
  const members = await getOrganizationMembersByNormalizedEmails(orgId, allEmails);
  const idByEmail = new Map(members.map((member) => [member.normalizedEmail, member.id]));

  for (const pair of pairs) {
    const managerEmail = pair.managerEmail?.toLowerCase().trim();
    if (!managerEmail) continue;

    const memberId = idByEmail.get(pair.memberEmail.toLowerCase().trim());
    const managerId = idByEmail.get(managerEmail);

    if (!memberId) continue;

    if (!managerId) {
      warnings.push(`Manager email not found: ${managerEmail}`);
      continue;
    }

    if (managerId === memberId) {
      warnings.push(`Manager cannot be self: ${pair.memberEmail}`);
      continue;
    }

    await updateOrganizationAudienceMember(orgId, memberId, { managerMemberId: managerId });
  }

  return warnings;
}

export async function createAudienceMember(orgId: string, data: TCreateAudienceMember, invitedByProfileId: string) {
  const organization = await getOrganizationById(orgId);
  if (!organization || !organization.siteName) {
    throw new AppError('Organization not found', ErrorCodes.ORGANIZATION_NOT_FOUND, 404);
  }

  const email = data.email.toLowerCase().trim();
  const existing = await getOrganizationMembersByNormalizedEmails(orgId, [email]);
  if (existing.length > 0) {
    throw new AppError('This email is already in the organization', ErrorCodes.VALIDATION_ERROR, 409, 'email');
  }

  const roleId = data.roleId;
  const isStudent = roleId === ROLE.STUDENT;

  if (isStudent) {
    await assertStudentCapacityOrThrow(orgId, 1);
  }

  const managerResolution = await resolveManagerMemberId(orgId, {
    managerMemberId: data.managerMemberId,
    managerEmail: data.managerEmail
  });

  const hrResolution = await resolveAudienceHrRefs(orgId, {
    positionId: data.positionId,
    departmentId: data.departmentId,
    jobTitle: data.jobTitle,
    department: data.department
  });

  if (hrResolution.error) {
    throw new AppError(hrResolution.error, ErrorCodes.VALIDATION_ERROR, 400, 'jobTitle');
  }

  const [created] = await createOrganizationMembers([
    {
      organizationId: orgId,
      email,
      roleId,
      verified: false,
      firstName: data.firstName,
      lastName: data.lastName,
      positionId: hrResolution.refs.positionId,
      departmentId: hrResolution.refs.departmentId,
      managerMemberId: managerResolution.managerMemberId
    }
  ]);

  if (!created) {
    throw new AppError('Failed to create audience member', ErrorCodes.INTERNAL_ERROR, 500);
  }

  const courseIds = data.courseIds ?? [];
  const cohortIds = data.cohortIds ?? [];
  let accessNamesLabel: string | undefined;

  if (courseIds.length > 0) {
    const courses = await getOrgCourses({ orgId, courseIds });
    const courseNames = courses.items.map((c) => c.title).filter(Boolean);
    accessNamesLabel = courseNames.length > 0 ? courseNames.join(', ') : undefined;
  }

  if (cohortIds.length > 0) {
    const cohorts = await getCohortsByOrg(orgId, cohortIds);
    const cohortNames = cohorts.map((cohort) => cohort.name).filter(Boolean);
    const labelParts = [accessNamesLabel, ...cohortNames].filter(Boolean) as string[];
    accessNamesLabel = labelParts.length > 0 ? labelParts.join(', ') : undefined;
  }

  let inviteOutcome = { created: 1, emailsSent: 0, emailsFailed: 0 };

  if (isStudent) {
    inviteOutcome = await createStudentOrgInvitesAndSendEmails({
      orgId,
      organization,
      emails: [email],
      courseIds,
      cohortIds,
      accessNamesLabel,
      invitedByProfileId,
      shouldSendEmail: data.sendEmail,
      deliveryEmailOverrides: buildDeliveryEmailOverrides([email], data.office365)
    });
  } else if (data.sendEmail) {
    // Admins and tutors get the role-bearing invite, which names the role and links to the
    // team accept flow rather than to course access.
    await sendStaffOrgInvite({
      orgId,
      organization: { name: organization.name, siteName: organization.siteName },
      email,
      roleId,
      invitedByProfileId,
      useOffice365Delivery: data.office365,
      source: 'ORG_USER_FORM'
    });
    inviteOutcome = { created: 1, emailsSent: 1, emailsFailed: 0 };
  }

  const member = await getOrganizationAudienceMember(orgId, created.id);

  // Audience rules enrol learners by job title and department; staff should not be pulled
  // into courses as students by that same matching.
  if (member && isStudent) {
    const hrStrings = audienceMemberHrStrings(member);
    await syncMemberToMatchingPublishedCourses(orgId, {
      memberId: member.id,
      profileId: member.profileId,
      email: member.email,
      jobTitle: hrStrings.jobTitle,
      department: hrStrings.department
    });
  }

  return {
    member,
    emailsSent: inviteOutcome.emailsSent,
    emailsFailed: inviteOutcome.emailsFailed,
    warnings: managerResolution.warning ? [managerResolution.warning] : []
  };
}

/**
 * Edits an existing member, including their role.
 *
 * Two guards protect the organization from locking itself out: an admin cannot demote their
 * own account, and the last remaining admin cannot be demoted at all. Both are checked here
 * rather than in the route so every caller inherits them.
 */
export async function updateAudienceMember(
  orgId: string,
  memberId: number,
  data: TUpdateAudienceMember,
  actorProfileId: string
) {
  const member = await getOrganizationAudienceMember(orgId, memberId);

  if (!member) {
    throw new AppError('Audience member not found', ErrorCodes.NOT_FOUND, 404);
  }

  const nextRoleId = data.roleId;
  const isRoleChanging = nextRoleId !== undefined && nextRoleId !== member.roleId;

  if (isRoleChanging && member.roleId === ROLE.ADMIN) {
    // Only count when it can matter; the query is pointless for a non-admin.
    const adminCount = await countOrganizationMembersByRole(orgId, ROLE.ADMIN);

    assertRoleChangeAllowed({
      currentRoleId: member.roleId,
      memberProfileId: member.profileId,
      actorProfileId,
      adminCount
    });
  }

  const managerResolution = await resolveManagerMemberId(orgId, {
    managerMemberId: data.managerMemberId ?? undefined,
    managerEmail: data.managerEmail
  });

  const hrResolution = await resolveAudienceHrRefs(orgId, {
    positionId: data.positionId ?? undefined,
    departmentId: data.departmentId ?? undefined,
    jobTitle: data.jobTitle,
    department: data.department
  });

  if (hrResolution.error) {
    throw new AppError(hrResolution.error, ErrorCodes.VALIDATION_ERROR, 400, 'jobTitle');
  }

  const changes: Parameters<typeof updateOrganizationAudienceMember>[2] = {};

  if (data.firstName !== undefined) changes.firstName = data.firstName ?? null;
  if (data.lastName !== undefined) changes.lastName = data.lastName ?? null;
  if (isRoleChanging) changes.roleId = nextRoleId;

  // An explicit null clears the reference; leaving the field out keeps the current value.
  if (data.positionId !== undefined || data.jobTitle !== undefined) {
    changes.positionId = hrResolution.refs.positionId;
  }

  if (data.departmentId !== undefined || data.department !== undefined) {
    changes.departmentId = hrResolution.refs.departmentId;
  }

  if (data.managerMemberId !== undefined || data.managerEmail !== undefined) {
    changes.managerMemberId = data.managerMemberId === null ? null : managerResolution.managerMemberId;
  }

  if (Object.keys(changes).length > 0) {
    await updateOrganizationAudienceMember(orgId, memberId, changes);
  }

  const updated = await getOrganizationAudienceMember(orgId, memberId);

  return {
    member: updated,
    warnings: managerResolution.warning ? [managerResolution.warning] : []
  };
}

async function resolveCourseIdsAndNamesForImport(orgId: string, data: TImportAudienceMembers) {
  let courseIds: string[] = [];
  let courseNames: string[] = [];
  if (data.allCourses) {
    const courses = await getOrgCourses({ orgId });
    courseIds = courses.items.map((c) => c.id);
    courseNames = courses.items.map((c) => c.title).filter(Boolean);
  } else if (data.courseIds && data.courseIds.length > 0) {
    const courses = await getOrgCourses({ orgId, courseIds: data.courseIds });
    courseIds = courses.items.map((c) => c.id);
    courseNames = courses.items.map((c) => c.title).filter(Boolean);
  }
  return { courseIds, courseNames };
}

async function resolveCohortIdsAndNamesForImport(orgId: string, data: TImportAudienceMembers) {
  let cohortIds: string[] = [];
  let cohortNames: string[] = [];

  if (data.allCohorts) {
    const cohorts = await getCohortsByOrg(orgId);
    cohortIds = cohorts.map((cohort) => cohort.id);
    cohortNames = cohorts.map((cohort) => cohort.name).filter(Boolean);
  } else if (data.cohortIds && data.cohortIds.length > 0) {
    const cohorts = await getCohortsByOrg(orgId, data.cohortIds);
    cohortIds = cohorts.map((cohort) => cohort.id);
    cohortNames = cohorts.map((cohort) => cohort.name).filter(Boolean);
  }

  return { cohortIds, cohortNames };
}

export async function enrollAudienceStudentProfilesInCourses(
  orgId: string,
  organization: NonNullable<Awaited<ReturnType<typeof getOrganizationById>>>,
  profileIds: string[],
  courseIds: string[],
  shouldSendEmail: boolean
): Promise<{ assigned: number; alreadyEnrolled: number; emailsSent: number }> {
  if (courseIds.length === 0 || profileIds.length === 0) {
    return { assigned: 0, alreadyEnrolled: 0, emailsSent: 0 };
  }

  const uniqueProfileIds = [...new Set(profileIds)];
  const orgMembers = await getOrgMembersByProfileIds(orgId, uniqueProfileIds);
  const studentMembers = orgMembers.filter((m) => m.profileId && m.roleId === ROLE.STUDENT);
  const validProfileIds = new Set(studentMembers.map((m) => m.profileId!));
  const profileEmailMap = new Map(studentMembers.filter((m) => m.profileId).map((m) => [m.profileId!, m.email ?? '']));

  const courseGroups = await getOrgCourseGroups(orgId, courseIds);

  if (courseGroups.length === 0) {
    return { assigned: 0, alreadyEnrolled: 0, emailsSent: 0 };
  }

  const validGroupIds = courseGroups.map((cg) => cg.groupId).filter(Boolean) as string[];
  const courseTitleByGroupId = new Map(courseGroups.map((cg) => [cg.groupId, cg.courseTitle]));
  const welcomeMessageByGroupId = new Map(courseGroups.map((cg) => [cg.groupId, cg.welcomeEmailMessage]));
  const validProfiles = uniqueProfileIds.filter((id) => validProfileIds.has(id));

  const pairs = validProfiles.flatMap((profileId) => validGroupIds.map((groupId) => ({ groupId, profileId })));

  const existingSet = await getExistingGroupMembers(pairs);

  const toInsert = pairs.filter((p) => !existingSet.has(`${p.groupId}:${p.profileId}`));
  const alreadyEnrolled = pairs.length - toInsert.length;

  if (toInsert.length > 0) {
    await addGroupMembers(
      toInsert.map((p) => ({
        groupId: p.groupId,
        roleId: ROLE.STUDENT,
        profileId: p.profileId,
        email: profileEmailMap.get(p.profileId) || undefined
      }))
    );

    await invalidateOrgStats(orgId);
  }

  if (validProfiles.length > 0) {
    await ensureComplianceEnrollmentRecordsForProfiles(courseIds, validProfiles);
  }

  let emailsSent = 0;
  const loginUrl = getDashboardBaseUrl(organization);

  if (shouldSendEmail && toInsert.length > 0) {
    const icsByGroupId = new Map(
      await Promise.all(courseGroups.map(async (cg) => [cg.groupId, await getWelcomeSessionIcs(cg.courseId)] as const))
    );

    const emailPromises = toInsert
      .filter((p) => profileEmailMap.get(p.profileId))
      .map(async (p) => {
        const email = profileEmailMap.get(p.profileId)!;
        try {
          await enqueueTransactionalEmail('studentCourseWelcome', {
            to: email,
            fields: {
              orgName: organization.name,
              courseName: courseTitleByGroupId.get(p.groupId) || 'Course',
              loginUrl,
              customMessage: welcomeMessageByGroupId.get(p.groupId) ?? undefined,
              branding: buildEmailBranding(organization)
            },
            from: buildEmailFromName(`${organization.name} (via Celluloplast Academy)`),
            idempotencyKey: `audience-course-welcome:${p.groupId}:${p.profileId}`,
            ics: icsByGroupId.get(p.groupId),
            preference: { organizationId: orgId, recipientProfileId: p.profileId }
          });
          emailsSent++;
        } catch (emailError) {
          console.error(`enrollAudienceStudentProfilesInCourses enqueue error for ${email}:`, emailError);
        }
      });

    await Promise.all(emailPromises);
  }

  return {
    assigned: toInsert.length,
    alreadyEnrolled,
    emailsSent
  };
}

async function enrollAudienceStudentProfilesInCohorts(
  organization: NonNullable<Awaited<ReturnType<typeof getOrganizationById>>>,
  orgId: string,
  profileIds: string[],
  cohortIds: string[],
  shouldSendEmail: boolean
): Promise<{ assigned: number; alreadyEnrolled: number; emailsSent: number }> {
  if (cohortIds.length === 0 || profileIds.length === 0) {
    return { assigned: 0, alreadyEnrolled: 0, emailsSent: 0 };
  }

  const uniqueProfileIds = [...new Set(profileIds)];
  const orgMembers = await getOrgMembersByProfileIds(orgId, uniqueProfileIds);
  const studentMembers = orgMembers.filter((member) => member.profileId && member.roleId === ROLE.STUDENT);
  const validProfileIds = new Set(studentMembers.map((member) => member.profileId!));
  const profileEmailMap = new Map(
    studentMembers.filter((member) => member.profileId).map((member) => [member.profileId!, member.email ?? ''])
  );

  const cohorts = await getCohortsByOrg(orgId, cohortIds);
  if (cohorts.length === 0) {
    return { assigned: 0, alreadyEnrolled: 0, emailsSent: 0 };
  }

  const cohortNameById = new Map(cohorts.map((cohort) => [cohort.id, cohort.name || 'Cohort']));
  const loginUrl = getDashboardBaseUrl(organization);
  const validCohortIds = cohorts.map((cohort) => cohort.id);
  const validProfiles = uniqueProfileIds.filter((profileId) => validProfileIds.has(profileId));
  const pairs = validProfiles.flatMap((profileId) => validCohortIds.map((cohortId) => ({ cohortId, profileId })));
  const existingSet = await getExistingCohortMembers(pairs);
  const toInsert = pairs.filter((pair) => !existingSet.has(`${pair.cohortId}:${pair.profileId}`));
  const alreadyEnrolled = pairs.length - toInsert.length;

  if (toInsert.length > 0) {
    await Promise.all(
      toInsert.map((pair) =>
        addCohortMember({
          cohortId: pair.cohortId,
          roleId: ROLE.STUDENT,
          profileId: pair.profileId,
          email: profileEmailMap.get(pair.profileId) || undefined
        })
      )
    );
  }

  let emailsSent = 0;

  if (shouldSendEmail && toInsert.length > 0) {
    await Promise.all(
      toInsert
        .filter((pair) => profileEmailMap.get(pair.profileId))
        .map(async (pair) => {
          const email = profileEmailMap.get(pair.profileId)!;

          try {
            await enqueueTransactionalEmail('studentCohortWelcome', {
              to: email,
              fields: {
                orgName: organization.name,
                cohortName: cohortNameById.get(pair.cohortId) || 'Cohort',
                loginUrl,
                branding: buildEmailBranding(organization)
              },
              from: buildEmailFromName(`${organization.name} (via Celluloplast Academy)`),
              idempotencyKey: `audience-cohort-welcome:${pair.cohortId}:${pair.profileId}`,
              preference: { organizationId: orgId, recipientProfileId: pair.profileId }
            });
            emailsSent++;
          } catch (emailError) {
            console.error(`enrollAudienceStudentProfilesInCohorts enqueue error for ${email}:`, emailError);
          }
        })
    );
  }

  return {
    assigned: toInsert.length,
    alreadyEnrolled,
    emailsSent
  };
}

async function createStudentOrgInvitesAndSendEmails(input: {
  orgId: string;
  organization: NonNullable<Awaited<ReturnType<typeof getOrganizationById>>>;
  emails: string[];
  courseIds: string[];
  cohortIds: string[];
  accessNamesLabel: string | undefined;
  invitedByProfileId: string;
  shouldSendEmail: boolean;
  /**
   * Redirects where the invite email is *delivered* for specific addresses, keyed by the
   * lowercased account email. The account/invite identity stays the entered email — only the
   * SMTP `to` changes. Used for the Office 365 checkbox during the cPanel/O365 mailbox
   * migration (see `toOffice365DeliveryEmail`): the account stays `user@celluloplast.com`,
   * the email is delivered to `user@celluloplast.onmicrosoft.com`.
   */
  deliveryEmailOverrides?: Map<string, string>;
}): Promise<{ created: number; emailsSent: number; emailsFailed: number }> {
  const {
    orgId,
    organization,
    emails,
    courseIds,
    cohortIds,
    accessNamesLabel,
    invitedByProfileId,
    shouldSendEmail,
    deliveryEmailOverrides
  } = input;

  if (emails.length === 0) {
    return { created: 0, emailsSent: 0, emailsFailed: 0 };
  }

  await revokeActiveOrganizationInvitesByEmails(orgId, emails, invitedByProfileId);

  const expiresAt = new Date(Date.now() + ORG_INVITE_EXPIRY_MS).toISOString();

  const inviteInputs = emails.map((email) => {
    const token = generateToken();
    return {
      email,
      token,
      row: {
        organizationId: orgId,
        roleId: ROLE.STUDENT,
        email,
        tokenHash: hashToken(token),
        createdByProfileId: invitedByProfileId,
        expiresAt,
        isRevoked: false,
        metadata: {
          source: 'AUDIENCE_IMPORT',
          courseIds: courseIds.length > 0 ? courseIds : undefined,
          cohortIds: cohortIds.length > 0 ? cohortIds : undefined
        }
      }
    };
  });

  const invites = await createOrganizationInvites(inviteInputs.map((i) => i.row));
  const inviteByEmail = new Map(invites.map((inv) => [(inv.email ?? '').toLowerCase(), inv]));
  const tokenByEmail = new Map(inviteInputs.map((i) => [i.email.toLowerCase(), i.token]));

  await createOrganizationInviteAudits(
    emails.map((email) => {
      const invite = inviteByEmail.get(email)!;
      return {
        inviteId: invite.id,
        organizationId: orgId,
        eventType: 'CREATED' as const,
        actorProfileId: invitedByProfileId,
        targetEmail: email,
        ipAddress: null,
        userAgent: null,
        metadata: {
          roleId: ROLE.STUDENT,
          roleName: 'Student',
          expiresAt,
          courseIds,
          cohortIds
        }
      };
    })
  );

  let emailsSent = 0;
  let emailsFailed = 0;

  if (shouldSendEmail) {
    const emailOutcomes = await mapWithConcurrency(emails, EMAIL_SEND_CONCURRENCY, async (email) => {
      const invite = inviteByEmail.get(email)!;
      const token = tokenByEmail.get(email)!;
      try {
        const inviteLink = buildInviteLink(token, organization);
        await enqueueTransactionalEmail('studentOrgInvite', {
          to: deliveryEmailOverrides?.get(email) ?? email,
          fields: {
            email,
            orgName: organization.name,
            inviteLink,
            expiresAt: getExpiryLabel(expiresAt),
            courseNames: accessNamesLabel,
            branding: buildEmailBranding(organization)
          },
          from: buildEmailFromName(`${organization.name} (via Celluloplast Academy)`),
          idempotencyKey: `student-org-invite:${invite.id}`
        });

        // Optimistic — see comment in services/organization/invite.ts.
        return {
          inviteId: invite.id,
          email,
          success: true as const,
          error: undefined as string | undefined
        };
      } catch (emailError) {
        const message = emailError instanceof Error ? emailError.message : 'Unknown email error';
        return { inviteId: invite.id, email, success: false as const, error: message };
      }
    });

    emailsSent = emailOutcomes.filter((o) => o.success).length;
    emailsFailed = emailOutcomes.length - emailsSent;

    await createOrganizationInviteAudits(
      emailOutcomes.map((o) => ({
        inviteId: o.inviteId,
        organizationId: orgId,
        eventType: o.success ? ('EMAIL_SENT' as const) : ('EMAIL_FAILED' as const),
        actorProfileId: invitedByProfileId,
        targetEmail: o.email,
        ipAddress: null,
        userAgent: null,
        metadata: o.success ? {} : { error: o.error ?? 'Unknown' }
      }))
    );
  }

  return { created: emails.length, emailsSent, emailsFailed };
}

export async function importAudienceMembers(orgId: string, data: TImportAudienceMembers, invitedByProfileId: string) {
  const organization = await getOrganizationById(orgId);
  if (!organization || !organization.siteName) {
    throw new AppError('Organization not found', ErrorCodes.ORGANIZATION_NOT_FOUND, 404);
  }

  const normalized = normalizeImportRows(data);
  const warnings: string[] = [...normalized.invalid.map((email) => `Invalid email: ${email}`)];

  if (normalized.invalid.length > 0 && normalized.rows.length === 0) {
    throw new AppError(
      `Invalid emails found: ${normalized.invalid.slice(0, 5).join(', ')}`,
      ErrorCodes.VALIDATION_ERROR,
      400,
      'rows'
    );
  }

  if (normalized.rows.length === 0) {
    throw new AppError('No valid emails provided', ErrorCodes.VALIDATION_ERROR, 400, 'rows');
  }

  const emails = normalized.rows.map((row) => row.email);
  const memberRows = await getOrganizationMembersByNormalizedEmails(orgId, emails);
  const memberByEmail = new Map(memberRows.map((m) => [m.normalizedEmail, m]));

  type ImportRowWithRefs = TAudienceImportRow & ResolvedHrRefs;
  const acceptedRows: ImportRowWithRefs[] = [];

  for (const row of normalized.rows) {
    const hrResolution = await resolveAudienceHrRefs(orgId, {
      jobTitle: row.jobTitle,
      department: row.department
    });

    if (hrResolution.error) {
      warnings.push(`${row.email}: ${hrResolution.error}`);
      continue;
    }

    acceptedRows.push({
      ...row,
      positionId: hrResolution.refs.positionId,
      departmentId: hrResolution.refs.departmentId
    });
  }

  if (acceptedRows.length === 0) {
    throw new AppError(warnings[0] ?? 'No valid rows to import', ErrorCodes.VALIDATION_ERROR, 400, 'rows');
  }

  const acceptedByEmail = new Map(acceptedRows.map((row) => [row.email, row]));

  const newRows: ImportRowWithRefs[] = [];
  const existingStudentProfileIds: string[] = [];
  const pendingStudentEmails: string[] = [];
  const teamEmails: string[] = [];

  for (const row of acceptedRows) {
    const m = memberByEmail.get(row.email);
    if (!m) {
      newRows.push(row);
      continue;
    }
    if (m.roleId !== ROLE.STUDENT) {
      teamEmails.push(row.email);
      continue;
    }
    if (!m.profileId) {
      pendingStudentEmails.push(row.email);
      continue;
    }
    existingStudentProfileIds.push(m.profileId);
  }

  if (teamEmails.length > 0) {
    throw new AppError(
      `These emails belong to organization staff, not students: ${teamEmails.slice(0, 8).join(', ')}${teamEmails.length > 8 ? '…' : ''}`,
      ErrorCodes.VALIDATION_ERROR,
      400,
      'rows'
    );
  }

  const { courseIds, courseNames } = await resolveCourseIdsAndNamesForImport(orgId, data);
  const { cohortIds, cohortNames } = await resolveCohortIdsAndNamesForImport(orgId, data);
  const accessNames = [...courseNames, ...cohortNames];
  const accessNamesLabel = accessNames.length > 0 ? accessNames.join(', ') : undefined;

  const assignedToCourses = await enrollAudienceStudentProfilesInCourses(
    orgId,
    organization,
    existingStudentProfileIds,
    courseIds,
    data.sendEmail
  );
  const assignedToCohorts = await enrollAudienceStudentProfilesInCohorts(
    organization,
    orgId,
    existingStudentProfileIds,
    cohortIds,
    data.sendEmail
  );

  let imported = 0;
  let importEmailsSent = 0;
  let importEmailsFailed = 0;

  if (newRows.length > 0) {
    await assertStudentCapacityOrThrow(orgId, newRows.length);
    const newEmails = newRows.map((row) => row.email);

    await createOrganizationMembers(
      newRows.map((row) => ({
        organizationId: orgId,
        email: row.email,
        roleId: ROLE.STUDENT,
        verified: false,
        firstName: row.firstName,
        lastName: row.lastName,
        positionId: row.positionId,
        departmentId: row.departmentId
      }))
    );

    const managerWarnings = await linkManagerMembersByEmail(
      orgId,
      newRows.map((row) => ({
        memberEmail: row.email,
        managerEmail: row.managerEmail
      }))
    );
    warnings.push(...managerWarnings);

    if (courseIds.length > 0) {
      const courseGroupMappings = await getCourseGroupIds(courseIds);
      const validGroupIds = courseGroupMappings.map((m) => m.groupId).filter(Boolean) as string[];

      if (validGroupIds.length > 0) {
        const profiles = await getProfilesByEmails(newEmails);
        if (profiles.length > 0) {
          const users = profiles.map((p) => ({ profileId: p.id, email: p.email ?? undefined }));
          await enrollUsersInCourseGroups(validGroupIds, users, ROLE.STUDENT);
          await invalidateOrgStats(orgId);
          await ensureComplianceEnrollmentRecordsForProfiles(
            courseIds,
            profiles.map((profile) => profile.id)
          );
        }
      }
    }

    if (cohortIds.length > 0) {
      const profiles = await getProfilesByEmails(newEmails);
      if (profiles.length > 0) {
        await enrollAudienceStudentProfilesInCohorts(
          organization,
          orgId,
          profiles.map((profile) => profile.id),
          cohortIds,
          false
        );
      }
    }

    const inviteOutcome = await createStudentOrgInvitesAndSendEmails({
      orgId,
      organization,
      emails: newEmails,
      courseIds,
      cohortIds,
      accessNamesLabel,
      invitedByProfileId,
      shouldSendEmail: data.sendEmail
    });
    imported = newRows.length;
    importEmailsSent = inviteOutcome.emailsSent;
    importEmailsFailed = inviteOutcome.emailsFailed;
  }

  // Update HR fields for pending students already in the org (re-import with richer CSV).
  for (const email of pendingStudentEmails) {
    const row = acceptedByEmail.get(email);
    const existing = memberByEmail.get(email);
    if (!row || !existing) continue;

    await updateOrganizationAudienceMember(orgId, existing.id, {
      firstName: row.firstName,
      lastName: row.lastName,
      positionId: row.positionId,
      departmentId: row.departmentId
    });
  }

  if (pendingStudentEmails.length > 0) {
    const pendingManagerWarnings = await linkManagerMembersByEmail(
      orgId,
      pendingStudentEmails.map((email) => ({
        memberEmail: email,
        managerEmail: acceptedByEmail.get(email)?.managerEmail
      }))
    );
    warnings.push(...pendingManagerWarnings);
  }

  let pendingEmailsSent = 0;
  let pendingEmailsFailed = 0;
  if (pendingStudentEmails.length > 0) {
    const pendingOutcome = await createStudentOrgInvitesAndSendEmails({
      orgId,
      organization,
      emails: pendingStudentEmails,
      courseIds,
      cohortIds,
      accessNamesLabel,
      invitedByProfileId,
      shouldSendEmail: data.sendEmail
    });
    pendingEmailsSent = pendingOutcome.emailsSent;
    pendingEmailsFailed = pendingOutcome.emailsFailed;
  }

  for (const row of acceptedRows) {
    const refreshedMembers = await getOrganizationMembersByNormalizedEmails(orgId, [row.email]);
    const memberRow = refreshedMembers[0];
    if (!memberRow || memberRow.roleId !== ROLE.STUDENT) {
      continue;
    }

    const member = await getOrganizationAudienceMember(orgId, memberRow.id);
    if (!member) {
      continue;
    }

    const hrStrings = audienceMemberHrStrings(member);
    await syncMemberToMatchingPublishedCourses(orgId, {
      memberId: member.id,
      profileId: member.profileId,
      email: member.email,
      jobTitle: hrStrings.jobTitle,
      department: hrStrings.department
    });
  }

  return {
    imported,
    assigned: assignedToCourses.assigned + assignedToCohorts.assigned,
    alreadyEnrolledInCourses: assignedToCourses.alreadyEnrolled,
    alreadyEnrolledInCohorts: assignedToCohorts.alreadyEnrolled,
    pendingInvitesRenewed: pendingStudentEmails.length,
    duplicates: normalized.duplicates.length,
    skipped: normalized.duplicates.length + teamEmails.length,
    emailsSent: assignedToCourses.emailsSent + assignedToCohorts.emailsSent + importEmailsSent + pendingEmailsSent,
    emailsFailed: importEmailsFailed + pendingEmailsFailed,
    warnings
  };
}

export async function resendAudienceInvite(orgId: string, data: TAudienceInviteByEmail, invitedByProfileId: string) {
  const organization = await getOrganizationById(orgId);
  if (!organization || !organization.siteName) {
    throw new AppError('Organization not found', ErrorCodes.ORGANIZATION_NOT_FOUND, 404);
  }

  const member = await getStudentOrganizationMemberByOrgAndEmail(orgId, data.email);
  if (!member) {
    throw new AppError('Audience member not found', ErrorCodes.VALIDATION_ERROR, 404, 'email');
  }
  if (member.profileId) {
    throw new AppError('Member has already joined', ErrorCodes.VALIDATION_ERROR, 400, 'email');
  }

  const emailToUse = member.email.toLowerCase().trim();

  const latestInvite = await getLatestOrganizationInviteRowByOrgAndEmail(orgId, emailToUse);
  const meta = (latestInvite?.metadata as { courseIds?: string[]; cohortIds?: string[] } | undefined) ?? {};
  const courseIdsFromMetadata = meta.courseIds?.filter(Boolean) ?? [];
  const cohortIdsFromMetadata = meta.cohortIds?.filter(Boolean) ?? [];

  let courseIds: string[] = [];
  let courseNames: string[] = [];
  if (courseIdsFromMetadata.length > 0) {
    const courses = await getOrgCourses({ orgId, courseIds: courseIdsFromMetadata });
    courseIds = courses.items.map((c) => c.id);
    courseNames = courses.items.map((c) => c.title).filter(Boolean);
  }

  let cohortIds: string[] = [];
  let cohortNames: string[] = [];
  if (cohortIdsFromMetadata.length > 0) {
    const cohorts = await getCohortsByOrg(orgId, cohortIdsFromMetadata);
    cohortIds = cohorts.map((cohort) => cohort.id);
    cohortNames = cohorts.map((cohort) => cohort.name).filter(Boolean);
  }

  await revokeActiveOrganizationInvitesByEmails(orgId, [emailToUse], invitedByProfileId);

  const expiresAt = new Date(Date.now() + ORG_INVITE_EXPIRY_MS).toISOString();
  const token = generateToken();
  const accessNames = [...courseNames, ...cohortNames];
  const accessNamesLabel = accessNames.length > 0 ? accessNames.join(', ') : undefined;

  const invite = await createOrganizationInvite({
    organizationId: orgId,
    roleId: ROLE.STUDENT,
    email: emailToUse,
    tokenHash: hashToken(token),
    createdByProfileId: invitedByProfileId,
    expiresAt,
    isRevoked: false,
    metadata: {
      source: 'AUDIENCE_RESEND',
      courseIds: courseIds.length > 0 ? courseIds : undefined,
      cohortIds: cohortIds.length > 0 ? cohortIds : undefined
    }
  });

  await createOrganizationInviteAudits([
    {
      inviteId: invite.id,
      organizationId: orgId,
      eventType: 'CREATED',
      actorProfileId: invitedByProfileId,
      targetEmail: emailToUse,
      ipAddress: null,
      userAgent: null,
      metadata: {
        roleId: ROLE.STUDENT,
        roleName: 'Student',
        expiresAt,
        courseIds,
        cohortIds
      }
    }
  ]);

  let emailSent = false;
  try {
    const inviteLink = buildInviteLink(token, organization);
    await enqueueTransactionalEmail('studentOrgInvite', {
      to: emailToUse,
      fields: {
        email: emailToUse,
        orgName: organization.name,
        inviteLink,
        expiresAt: getExpiryLabel(expiresAt),
        courseNames: accessNamesLabel,
        branding: buildEmailBranding(organization)
      },
      from: buildEmailFromName(`${organization.name} (via Celluloplast Academy)`),
      idempotencyKey: `student-org-invite:${invite.id}`
    });

    emailSent = true;
    // Optimistic EMAIL_SENT — worker handles retries; final failure flips
    // email_delivery to `failed` for operator follow-up.
    await createOrganizationInviteAudits([
      {
        inviteId: invite.id,
        organizationId: orgId,
        eventType: 'EMAIL_SENT',
        actorProfileId: invitedByProfileId,
        targetEmail: emailToUse,
        ipAddress: null,
        userAgent: null,
        metadata: {}
      }
    ]);
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : 'Unknown email error';
    await createOrganizationInviteAudits([
      {
        inviteId: invite.id,
        organizationId: orgId,
        eventType: 'EMAIL_FAILED',
        actorProfileId: invitedByProfileId,
        targetEmail: emailToUse,
        ipAddress: null,
        userAgent: null,
        metadata: { error: message }
      }
    ]);
  }

  return { emailSent };
}

export async function revokeAudiencePendingInvite(
  orgId: string,
  data: TAudienceInviteByEmail,
  revokedByProfileId: string
) {
  const member = await getStudentOrganizationMemberByOrgAndEmail(orgId, data.email);
  if (!member) {
    throw new AppError('Audience member not found', ErrorCodes.VALIDATION_ERROR, 404, 'email');
  }
  if (member.profileId) {
    throw new AppError('Member has already joined', ErrorCodes.VALIDATION_ERROR, 400, 'email');
  }

  const emailToUse = member.email.toLowerCase().trim();

  const hasActive = await hasActiveOrganizationInviteForEmail(orgId, emailToUse);
  if (!hasActive) {
    throw new AppError('No active pending invite to revoke', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const revoked = await revokeActiveOrganizationInvitesByEmails(orgId, [emailToUse], revokedByProfileId);
  if (revoked.length === 0) {
    throw new AppError('No invite was revoked', ErrorCodes.VALIDATION_ERROR, 400);
  }

  await createOrganizationInviteAudits(
    revoked.map((inv) => ({
      inviteId: inv.id,
      organizationId: orgId,
      eventType: 'REVOKED' as const,
      actorProfileId: revokedByProfileId,
      targetEmail: emailToUse,
      ipAddress: null,
      userAgent: null,
      metadata: { reason: 'audience_revoked_by_admin' }
    }))
  );

  return { revoked: true };
}

/**
 * The courses a specific person can actually be given, so the picker offers only what the
 * rules allow instead of letting someone choose a course the server will then refuse.
 *
 * Courses with no audience rule are ungoverned and always assignable.
 */
export async function getAssignableCoursesForMember(orgId: string, profileId: string) {
  const [allCourses, governedCourses, members] = await Promise.all([
    getOrgCourses({ orgId }),
    getPublishedCoursesWithAudienceAssignment(orgId),
    getOrgMembersByProfileIds(orgId, [profileId])
  ]);

  const member = members[0];

  if (!member) {
    throw new AppError('Audience member not found', ErrorCodes.NOT_FOUND, 404);
  }

  const governedById = new Map(governedCourses.map((course) => [course.id, course]));
  const eligibilityMember = {
    memberId: member.memberId,
    jobTitle: member.jobTitle,
    department: member.department
  };

  return allCourses.items
    .filter((course) => {
      const governed = governedById.get(course.id);

      if (!governed) return true;

      return resolveDirectAssignment(eligibilityMember, governed.audienceAssignment) !== 'refused';
    })
    .map((course) => ({ id: course.id, title: course.title }));
}

/**
 * Direct assignment has to agree with the rule that governs each course, otherwise a course
 * reserved for a department could be handed to someone outside it and the two views of who
 * may take it would disagree.
 *
 * Courses with no audience rule are ungoverned and always assignable. A course targeting an
 * explicit list of people is the per-employee case: the member joins that list, so the grant
 * lives in the model rather than as an enrolment the rule knows nothing about.
 */
async function assertDirectAssignmentIsEligible(
  orgId: string,
  courseIds: string[],
  profileIds: string[]
): Promise<void> {
  if (profileIds.length === 0) {
    return;
  }

  const [governedCourses, members] = await Promise.all([
    getPublishedCoursesWithAudienceAssignment(orgId),
    getOrgMembersByProfileIds(orgId, profileIds)
  ]);

  const governedById = new Map(governedCourses.map((course) => [course.id, course]));
  const refusedCourseTitles = new Set<string>();
  const memberIdsToAddByCourse = new Map<string, Set<number>>();

  for (const courseId of courseIds) {
    const course = governedById.get(courseId);

    if (!course) continue;

    for (const member of members) {
      const outcome = resolveDirectAssignment(
        { memberId: member.memberId, jobTitle: member.jobTitle, department: member.department },
        course.audienceAssignment
      );

      if (outcome === 'refused') {
        refusedCourseTitles.add(course.title);
        continue;
      }

      if (outcome === 'addToMemberList') {
        const pending = memberIdsToAddByCourse.get(courseId) ?? new Set<number>();
        pending.add(member.memberId);
        memberIdsToAddByCourse.set(courseId, pending);
      }
    }
  }

  if (refusedCourseTitles.size > 0) {
    const titles = [...refusedCourseTitles].join(', ');

    throw new AppError(
      `These courses are reserved for a department or job title this person is not in: ${titles}`,
      ErrorCodes.VALIDATION_ERROR,
      409,
      'courseIds'
    );
  }

  for (const [courseId, memberIds] of memberIdsToAddByCourse) {
    await addMembersToCourseAudienceList(courseId, memberIds);
  }
}

/** Widens a course's explicit member list, preserving the rest of its metadata. */
async function addMembersToCourseAudienceList(courseId: string, memberIds: Set<number>): Promise<void> {
  const [course] = await getCourseById(courseId);

  if (!course) return;

  const metadata = (course.metadata ?? {}) as Record<string, unknown>;
  const assignment = metadata.audienceAssignment as TCourseAudienceAssignment | undefined;

  if (!assignment || assignment.mode !== 'members') return;

  const nextMemberIds = [...new Set([...(assignment.memberIds ?? []), ...memberIds])];

  const nextMetadata = {
    ...metadata,
    audienceAssignment: { ...assignment, memberIds: nextMemberIds }
  } as unknown as TCourse['metadata'];

  await updateCourse(courseId, { metadata: nextMetadata });
}

export async function assignAudienceToCourses(orgId: string, data: TAssignAudienceCourses) {
  const organization = await getOrganizationById(orgId);
  if (!organization) {
    throw new AppError('Organization not found', ErrorCodes.ORGANIZATION_NOT_FOUND, 404);
  }

  const courseIds = data.courseIds ?? [];
  const cohortIds = data.cohortIds ?? [];

  let assignedToCourses = { assigned: 0, alreadyEnrolled: 0, emailsSent: 0 };
  let assignedToCohorts = { assigned: 0, alreadyEnrolled: 0, emailsSent: 0 };

  if (courseIds.length > 0) {
    const courseGroups = await getOrgCourseGroups(orgId, courseIds);
    if (courseGroups.length === 0) {
      throw new AppError('No valid courses found', ErrorCodes.VALIDATION_ERROR, 400, 'courseIds');
    }

    await assertDirectAssignmentIsEligible(orgId, courseIds, data.profileIds);

    assignedToCourses = await enrollAudienceStudentProfilesInCourses(
      orgId,
      organization,
      data.profileIds,
      courseIds,
      data.sendEmail
    );
  }

  if (cohortIds.length > 0) {
    const cohorts = await getCohortsByOrg(orgId, cohortIds);
    if (cohorts.length === 0) {
      throw new AppError('No valid cohorts found', ErrorCodes.VALIDATION_ERROR, 400, 'cohortIds');
    }

    assignedToCohorts = await enrollAudienceStudentProfilesInCohorts(
      organization,
      orgId,
      data.profileIds,
      cohortIds,
      data.sendEmail
    );
  }

  return {
    assigned: assignedToCourses.assigned + assignedToCohorts.assigned,
    alreadyEnrolled: assignedToCourses.alreadyEnrolled + assignedToCohorts.alreadyEnrolled,
    emailsSent: assignedToCourses.emailsSent + assignedToCohorts.emailsSent
  };
}

export async function updatePendingAudienceMemberEmail(
  orgId: string,
  memberId: number,
  data: { email: string; sendEmail: boolean },
  invitedByProfileId: string
) {
  const organization = await getOrganizationById(orgId);
  if (!organization) {
    throw new AppError('Organization not found', ErrorCodes.ORGANIZATION_NOT_FOUND, 404);
  }

  const existingMember = await getOrganizationAudienceMember(orgId, memberId);
  if (!existingMember) {
    throw new AppError('Audience member not found', ErrorCodes.NOT_FOUND, 404);
  }

  if (existingMember.profileId) {
    throw new AppError(
      'Only pending audience members can be updated through this endpoint',
      ErrorCodes.VALIDATION_ERROR,
      400,
      'memberId'
    );
  }

  const normalizedEmail = data.email.toLowerCase().trim();
  const currentEmail = existingMember.email.toLowerCase().trim();

  if (!normalizedEmail) {
    throw new AppError('Email is required', ErrorCodes.VALIDATION_ERROR, 400, 'email');
  }

  if (normalizedEmail !== currentEmail) {
    const matchingMembers = await getOrganizationMembersByNormalizedEmails(orgId, [normalizedEmail]);

    if (matchingMembers.length > 0) {
      throw new AppError('An audience member with this email already exists', ErrorCodes.CONFLICT, 409, 'email');
    }
  }

  await revokeActiveOrganizationInvitesByEmails(orgId, [currentEmail, normalizedEmail], invitedByProfileId);

  const updatedMember = await updateOrganizationAudienceMember(orgId, memberId, {
    email: normalizedEmail,
    verified: false
  });

  if (!updatedMember) {
    throw new AppError('Audience member not found', ErrorCodes.NOT_FOUND, 404);
  }

  const latestInvite = await getLatestOrganizationInviteRowByOrgAndEmail(orgId, currentEmail);
  const meta = (latestInvite?.metadata as { courseIds?: string[]; cohortIds?: string[] } | undefined) ?? {};

  await createStudentOrgInvitesAndSendEmails({
    orgId,
    organization,
    emails: [normalizedEmail],
    courseIds: meta.courseIds?.filter(Boolean) ?? [],
    cohortIds: meta.cohortIds?.filter(Boolean) ?? [],
    accessNamesLabel: undefined,
    invitedByProfileId,
    shouldSendEmail: data.sendEmail
  });

  return updatedMember;
}
