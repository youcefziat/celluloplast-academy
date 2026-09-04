import * as schema from '@db/schema';

import type { OrganizationPlan, OrganizationWithMemberAndPlans, OrganizationWithPlans } from './types';
import type {
  TNewOrganization,
  TNewOrganizationPlan,
  TNewOrganizationmember,
  TOrganization,
  TOrganizationPlan
} from '@db/types';
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  not,
  notInArray,
  or,
  sql
} from 'drizzle-orm';

import { PLAN } from '@cio/utils/plans';
import { ROLE } from '@cio/utils/constants';
import { alias } from 'drizzle-orm/pg-core';
import { CELLULOPLAST_PRIMARY_ORG, CELLULOPLAST_PRIMARY_ORG_ID } from '@db/utils/seed/celluloplast-organization';
import { db, type DbOrTxClient } from '@db/drizzle';
import type { TAudienceSortBy, TAudienceSortOrder } from '@cio/utils/validation/organization';
import type { TCourseAudienceAssignmentMode } from '@cio/utils/validation/course';

export function getOrgIdBySiteName(siteName: string) {
  return db.select().from(schema.organization).where(eq(schema.organization.siteName, siteName)).limit(1);
}

/**
 * Hostnames (lowercase) for organizations with a verified custom domain.
 * Used by the API to warm an in-memory CORS / trusted-origin registry at startup.
 */
export async function getVerifiedCustomDomainHostnames(): Promise<string[]> {
  try {
    const rows = await db
      .select({ customDomain: schema.organization.customDomain })
      .from(schema.organization)
      .where(and(eq(schema.organization.isCustomDomainVerified, true), isNotNull(schema.organization.customDomain)));

    return [...new Set(rows.map((row) => row.customDomain?.trim().toLowerCase()).filter(Boolean) as string[])];
  } catch (error) {
    console.error('getVerifiedCustomDomainHostnames error:', error);
    throw new Error(
      `Failed to load verified custom domains: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export const getOrganizationByProfileId = async (profileId: string): Promise<OrganizationWithMemberAndPlans[]> => {
  const result = await db
    .select({
      organization: schema.organization,
      memberId: schema.organizationmember.id,
      roleId: schema.organizationmember.roleId,
      plan: {
        planName: schema.organizationPlan.planName,
        isActive: schema.organizationPlan.isActive,
        provider: schema.organizationPlan.provider,
        subscriptionId: schema.organizationPlan.subscriptionId,
        customerId: sql`organization_plan.payload->>'customerId'`.as('customerId')
      }
    })
    .from(schema.organization)
    .leftJoin(schema.organizationmember, eq(schema.organization.id, schema.organizationmember.organizationId))
    .leftJoin(schema.organizationPlan, eq(schema.organization.id, schema.organizationPlan.orgId))
    .where(eq(schema.organizationmember.profileId, profileId));

  // Group by organization and collect plans into an array
  const organizationMap = new Map<
    string,
    {
      organization: typeof schema.organization.$inferSelect;
      memberId: number | undefined;
      roleId: number | undefined;
      plans: Array<OrganizationPlan>;
    }
  >();

  for (const row of result) {
    const orgId = row.organization.id;

    if (!organizationMap.has(orgId)) {
      organizationMap.set(orgId, {
        organization: row.organization,
        memberId: row.memberId ?? undefined,
        roleId: row.roleId ?? undefined,
        plans: []
      });
    }

    const orgData = organizationMap.get(orgId)!;

    // Add plan to array if it exists (not null)
    if (
      row.plan &&
      (row.plan.planName !== null ||
        row.plan.isActive !== null ||
        row.plan.provider !== null ||
        row.plan.subscriptionId !== null)
    ) {
      orgData.plans.push({
        planName: row.plan.planName,
        isActive: row.plan.isActive,
        provider: row.plan.provider,
        subscriptionId: row.plan.subscriptionId,
        customerId: row.plan.customerId as string | null
      });
    }
  }

  return Array.from(organizationMap.values()).map(({ organization, ...rest }) => ({
    ...(organization as TOrganization),
    ...rest
  }));
};

export const createOrganization = async (data: TNewOrganization, dbClient: DbOrTxClient = db) => {
  const [organization] = await dbClient.insert(schema.organization).values(data).returning();

  return organization;
};

export const createOrganizationMember = async (data: TNewOrganizationmember, dbClient: DbOrTxClient = db) => {
  const [member] = await dbClient.insert(schema.organizationmember).values(data).returning();

  return member;
};

export async function getOrganizationMemberByIdAndOrg(
  memberId: number,
  organizationId: string,
  dbClient: DbOrTxClient = db
): Promise<{ id: number; profileId: string | null } | null> {
  try {
    const [row] = await dbClient
      .select({
        id: schema.organizationmember.id,
        profileId: schema.organizationmember.profileId
      })
      .from(schema.organizationmember)
      .where(
        and(eq(schema.organizationmember.id, memberId), eq(schema.organizationmember.organizationId, organizationId))
      )
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getOrganizationMemberByIdAndOrg error:', error);
    throw new Error(
      `Failed to resolve organization membership: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function getOrganizationMemberIdByOrgAndProfile(
  organizationId: string,
  profileId: string,
  dbClient: DbOrTxClient = db
): Promise<number | null> {
  try {
    const [row] = await dbClient
      .select({ id: schema.organizationmember.id })
      .from(schema.organizationmember)
      .where(
        and(
          eq(schema.organizationmember.organizationId, organizationId),
          eq(schema.organizationmember.profileId, profileId)
        )
      )
      .limit(1);

    return row?.id ?? null;
  } catch (error) {
    console.error('getOrganizationMemberIdByOrgAndProfile error:', error);
    throw new Error(
      `Failed to resolve organization membership: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Creates multiple organization members in a single query
 * @param data Array of organization member creation data
 * @returns Array of created members
 */
export const createOrganizationMembers = async (data: TNewOrganizationmember[]) => {
  const members = await db.insert(schema.organizationmember).values(data).onConflictDoNothing().returning();

  return members;
};

export async function insertOrganizationMembersOnConflictDoNothing(
  data: TNewOrganizationmember[],
  dbClient: DbOrTxClient = db
): Promise<void> {
  if (data.length === 0) {
    return;
  }

  try {
    await dbClient.insert(schema.organizationmember).values(data).onConflictDoNothing();
  } catch (error) {
    console.error('insertOrganizationMembersOnConflictDoNothing error:', error);
    throw new Error(
      `Failed to insert organization members: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export const checkSiteNameExists = async (siteName: string, excludeOrgId?: string): Promise<boolean> => {
  const conditions = [eq(schema.organization.siteName, siteName)];

  if (excludeOrgId) {
    conditions.push(ne(schema.organization.id, excludeOrgId));
  }

  const result = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(and(...conditions))
    .limit(1);

  return result.length > 0;
};

/**
 * Gets an organization by siteName
 * @param siteName Organization site name
 * @returns Organization or null if not found
 */
export const getOrganizationBySiteName = async (siteName: string): Promise<TOrganization | null> => {
  const [organization] = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.siteName, siteName))
    .limit(1);

  return organization || null;
};

/**
 * Gets an organization by its verified custom domain.
 * Only matches rows where isCustomDomainVerified is true so we never auto-enroll
 * a signup into an org just because someone pointed DNS at us.
 */
export const getOrganizationByCustomDomain = async (customDomain: string): Promise<TOrganization | null> => {
  const [organization] = await db
    .select()
    .from(schema.organization)
    .where(
      and(
        eq(schema.organization.customDomain, customDomain.toLowerCase()),
        eq(schema.organization.isCustomDomainVerified, true)
      )
    )
    .limit(1);

  return organization || null;
};

/**
 * Gets an organization by ID
 * @param id Organization ID
 * @returns Organization or null if not found
 */
export const getOrganizationById = async (id: string): Promise<TOrganization | null> => {
  const [organization] = await db.select().from(schema.organization).where(eq(schema.organization.id, id)).limit(1);

  return organization || null;
};

export const deleteOrganizationById = async (id: string) => {
  await db.delete(schema.organization).where(eq(schema.organization.id, id));
};

/**
 * Checks if an email already exists as a team member in an organization
 * @param orgId Organization ID
 * @param email Email address to check
 * @returns True if email exists, false otherwise
 */
export const checkEmailExistsInOrg = async (orgId: string, email: string): Promise<boolean> => {
  const result = await db
    .select({ id: schema.organizationmember.id })
    .from(schema.organizationmember)
    .where(
      and(eq(schema.organizationmember.organizationId, orgId), eq(schema.organizationmember.email, email.toLowerCase()))
    )
    .limit(1);

  return result.length > 0;
};

/**
 * Checks if an org has a member matching the given profileId or email.
 * Used to avoid creating duplicate members (e.g. when user has a pending invite).
 */
export const hasOrgMemberByProfileIdOrEmail = async (
  orgId: string,
  profileId: string,
  email: string | null | undefined
): Promise<boolean> => {
  const conditions = [eq(schema.organizationmember.organizationId, orgId)];

  const profileOrEmailMatch = or(
    eq(schema.organizationmember.profileId, profileId),
    ...(email ? [eq(schema.organizationmember.email, email.toLowerCase().trim())] : [])
  );

  const result = await db
    .select({ id: schema.organizationmember.id })
    .from(schema.organizationmember)
    .where(and(...conditions, profileOrEmailMatch))
    .limit(1);

  return result.length > 0;
};

/**
 * Checks which emails already exist as team members in an organization (bulk check)
 * Checks both organizationmember.email and profile.email (via organizationmember.profileId)
 * @param orgId Organization ID
 * @param emails Array of email addresses to check (should already be normalized)
 * @returns Array of emails that already exist in the organization
 */
export const checkEmailsExistInOrg = async (orgId: string, emails: string[]): Promise<string[]> => {
  if (emails.length === 0) {
    return [];
  }

  const [orgMemberEmails, profileEmails] = await Promise.all([
    db
      .select({ email: schema.organizationmember.email })
      .from(schema.organizationmember)
      .where(
        and(eq(schema.organizationmember.organizationId, orgId), inArray(schema.organizationmember.email, emails))
      ),
    db
      .select({ email: schema.profile.email })
      .from(schema.organizationmember)
      .innerJoin(schema.profile, eq(schema.organizationmember.profileId, schema.profile.id))
      .where(and(eq(schema.organizationmember.organizationId, orgId), inArray(schema.profile.email, emails)))
  ]);

  const existingEmails = new Set<string>();
  orgMemberEmails.forEach((r) => {
    if (r.email) {
      existingEmails.add(r.email.toLowerCase());
    }
  });
  profileEmails.forEach((r) => {
    if (r.email) {
      existingEmails.add(r.email.toLowerCase());
    }
  });

  return Array.from(existingEmails);
};

/**
 * Deletes an organization member by ID
 * @param orgId Organization ID
 * @param memberId Member ID to delete
 * @returns Deleted member or null if not found
 */
export const deleteOrganizationMember = async (orgId: string, memberId: number) => {
  const [deleted] = await db
    .delete(schema.organizationmember)
    .where(and(eq(schema.organizationmember.organizationId, orgId), eq(schema.organizationmember.id, memberId)))
    .returning();

  return deleted || null;
};

/**
 * Deletes a student organization member by ID
 * @param orgId Organization ID
 * @param memberId Member ID to delete
 * @returns Deleted member or null if not found
 */
export const deleteOrganizationAudienceMember = async (orgId: string, memberId: number) => {
  const [deleted] = await db
    .delete(schema.organizationmember)
    .where(
      and(
        eq(schema.organizationmember.organizationId, orgId),
        eq(schema.organizationmember.id, memberId),
        eq(schema.organizationmember.roleId, ROLE.STUDENT)
      )
    )
    .returning();

  return deleted || null;
};

export const getOrganizationAudienceMember = async (orgId: string, memberId: number) => {
  const managerMember = alias(schema.organizationmember, 'manager_member');
  const managerProfile = alias(schema.profile, 'manager_profile');

  const [row] = await db
    .select({
      memberId: schema.organizationmember.id,
      roleId: schema.organizationmember.roleId,
      profileId: schema.organizationmember.profileId,
      fullname: schema.profile.fullname,
      firstName: schema.organizationmember.firstName,
      lastName: schema.organizationmember.lastName,
      positionId: schema.organizationmember.positionId,
      positionName: schema.organizationPosition.name,
      departmentId: schema.organizationmember.departmentId,
      departmentName: schema.organizationDepartment.name,
      managerMemberId: schema.organizationmember.managerMemberId,
      managerEmail: sql<string | null>`coalesce(${managerProfile.email}, ${managerMember.email})`.as('managerEmail'),
      managerFullname: managerProfile.fullname,
      managerFirstName: managerMember.firstName,
      managerLastName: managerMember.lastName,
      email: sql<string>`coalesce(${schema.profile.email}, ${schema.organizationmember.email})`.as('email'),
      avatarUrl: schema.profile.avatarUrl,
      profileCreatedAt: schema.profile.createdAt,
      memberCreatedAt: schema.organizationmember.createdAt
    })
    .from(schema.organizationmember)
    .leftJoin(schema.profile, eq(schema.organizationmember.profileId, schema.profile.id))
    .leftJoin(schema.organizationPosition, eq(schema.organizationmember.positionId, schema.organizationPosition.id))
    .leftJoin(
      schema.organizationDepartment,
      eq(schema.organizationmember.departmentId, schema.organizationDepartment.id)
    )
    .leftJoin(managerMember, eq(schema.organizationmember.managerMemberId, managerMember.id))
    .leftJoin(managerProfile, eq(managerMember.profileId, managerProfile.id))
    .where(and(eq(schema.organizationmember.organizationId, orgId), eq(schema.organizationmember.id, memberId)))
    .limit(1);

  if (!row) {
    return null;
  }

  const email = row.email?.trim() ?? '';
  const composedName = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  const name = row.fullname?.trim() || composedName || (email.includes('@') ? email.split('@')[0] : email) || '';
  const createdAtRaw = row.profileId ? row.profileCreatedAt : row.memberCreatedAt;
  const createdAt = createdAtRaw ? new Date(createdAtRaw).toDateString() : '';
  const managerName =
    row.managerFullname?.trim() ||
    [row.managerFirstName, row.managerLastName].filter(Boolean).join(' ').trim() ||
    row.managerEmail?.trim() ||
    '';

  return {
    id: row.memberId,
    roleId: row.roleId,
    profileId: row.profileId ?? null,
    name,
    email,
    avatarUrl: row.avatarUrl || '',
    createdAt,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    jobTitle: row.positionName ?? null,
    position: row.positionId
      ? {
          id: row.positionId,
          name: row.positionName ?? ''
        }
      : null,
    department: row.departmentId
      ? {
          id: row.departmentId,
          name: row.departmentName ?? ''
        }
      : null,
    manager: row.managerMemberId
      ? {
          id: row.managerMemberId,
          email: row.managerEmail?.trim() ?? '',
          name: managerName
        }
      : null
  };
};

export const updateOrganizationAudienceMember = async (
  orgId: string,
  memberId: number,
  data: Partial<
    Pick<
      TNewOrganizationmember,
      'email' | 'verified' | 'firstName' | 'lastName' | 'positionId' | 'departmentId' | 'managerMemberId' | 'roleId'
    >
  >
) => {
  const [updated] = await db
    .update(schema.organizationmember)
    .set(data)
    .where(and(eq(schema.organizationmember.organizationId, orgId), eq(schema.organizationmember.id, memberId)))
    .returning();

  return updated || null;
};

/**
 * Checks if a user is an admin of an organization
 * @param orgId Organization ID
 * @param profileId Profile ID to check
 * @returns True if user is admin, false otherwise
 */
export const isUserOrgAdmin = async (orgId: string, profileId: string): Promise<boolean> => {
  const result = await db
    .select({ roleId: schema.organizationmember.roleId })
    .from(schema.organizationmember)
    .where(
      and(
        eq(schema.organizationmember.organizationId, orgId),
        eq(schema.organizationmember.profileId, profileId),
        eq(schema.organizationmember.roleId, ROLE.ADMIN)
      )
    )
    .limit(1);

  return result.length > 0;
};

/**
 * Gets a user's role in an organization
 * @param orgId Organization ID
 * @param profileId Profile ID to check
 * @returns Role ID if user is a member, null otherwise
 */
export const getUserOrgRole = async (orgId: string, profileId: string): Promise<number | null> => {
  const result = await db
    .select({ roleId: schema.organizationmember.roleId })
    .from(schema.organizationmember)
    .where(and(eq(schema.organizationmember.organizationId, orgId), eq(schema.organizationmember.profileId, profileId)))
    .limit(1);

  return result.length > 0 ? Number(result[0].roleId) : null;
};

/**
 * Gets all org memberships for a user as { [orgId]: roleId }.
 * Used to attach org roles to the Better Auth session so middleware can
 * read membership/role from the session cookie cache instead of hitting the DB.
 */
export const getUserOrgRolesMap = async (profileId: string): Promise<Record<string, number>> => {
  try {
    const rows = await db
      .select({
        organizationId: schema.organizationmember.organizationId,
        roleId: schema.organizationmember.roleId
      })
      .from(schema.organizationmember)
      .where(eq(schema.organizationmember.profileId, profileId));

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.organizationId] = Number(row.roleId);
    }

    return map;
  } catch (error) {
    console.error('getUserOrgRolesMap error:', error);
    throw new Error('Failed to fetch user org roles map');
  }
};

/**
 * Checks if a user is a team member (ADMIN or TUTOR) of an organization
 * @param orgId Organization ID
 * @param profileId Profile ID to check
 * @returns True if user is ADMIN or TUTOR, false otherwise
 */
export const isUserOrgTeamMember = async (orgId: string, profileId: string): Promise<boolean> => {
  const result = await db
    .select({ roleId: schema.organizationmember.roleId })
    .from(schema.organizationmember)
    .where(
      and(
        eq(schema.organizationmember.organizationId, orgId),
        eq(schema.organizationmember.profileId, profileId),
        or(eq(schema.organizationmember.roleId, ROLE.ADMIN), eq(schema.organizationmember.roleId, ROLE.TUTOR))
      )
    )
    .limit(1);

  return result.length > 0;
};

/**
 * Gets organization team members (non-students)
 * @param orgId Organization ID
 * @returns Array of team members with profile information
 */
export const getOrganizationTeam = async (orgId: string) => {
  const result = await db
    .select({
      id: schema.organizationmember.id,
      email: schema.organizationmember.email,
      verified: schema.organizationmember.verified,
      roleId: schema.organizationmember.roleId,
      profile: {
        id: schema.profile.id,
        fullname: schema.profile.fullname,
        email: schema.profile.email
      }
    })
    .from(schema.organizationmember)
    .leftJoin(schema.profile, eq(schema.organizationmember.profileId, schema.profile.id))
    .where(
      and(
        eq(schema.organizationmember.organizationId, orgId),
        sql`${schema.organizationmember.roleId} != ${ROLE.STUDENT}`
      )
    )
    .orderBy(sql`${schema.organizationmember.id} DESC`);

  return result.map((member) => ({
    id: member.id,
    email: member.profile?.email || member.email || '',
    verified: member.verified,
    roleId: member.roleId,
    profileId: member.profile?.id,
    fullname: member.profile?.fullname || ''
  }));
};

/**
 * Counts active organization members with the student role. Used to enforce per-plan student caps.
 */
export async function countActiveStudents(orgId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ count: count(schema.organizationmember.id) })
      .from(schema.organizationmember)
      .where(
        and(eq(schema.organizationmember.organizationId, orgId), eq(schema.organizationmember.roleId, ROLE.STUDENT))
      );

    return Number(row?.count ?? 0);
  } catch (error) {
    console.error('countActiveStudents error:', error);
    throw new Error('Failed to count active students');
  }
}

/**
 * Gets verified admin emails for an organization. Used to notify admins about plan-limit events.
 */
export async function getOrganizationAdminEmails(orgId: string): Promise<Array<{ email: string; fullname: string }>> {
  try {
    const result = await db
      .select({
        email: schema.organizationmember.email,
        profileEmail: schema.profile.email,
        fullname: schema.profile.fullname
      })
      .from(schema.organizationmember)
      .leftJoin(schema.profile, eq(schema.organizationmember.profileId, schema.profile.id))
      .where(
        and(
          eq(schema.organizationmember.organizationId, orgId),
          eq(schema.organizationmember.roleId, ROLE.ADMIN),
          eq(schema.organizationmember.verified, true)
        )
      );

    return result
      .map((member) => ({
        email: member.profileEmail || member.email || '',
        fullname: member.fullname || ''
      }))
      .filter((member) => member.email);
  } catch (error) {
    console.error('getOrganizationAdminEmails error:', error);
    throw new Error('Failed to get organization admin emails');
  }
}

/**
 * Counts members holding a role, so a role change can refuse to remove the last admin and
 * leave the organization unadministrable.
 */
export const countOrganizationMembersByRole = async (orgId: string, roleId: number): Promise<number> => {
  const [row] = await db
    .select({ count: count(schema.organizationmember.id) })
    .from(schema.organizationmember)
    .where(and(eq(schema.organizationmember.organizationId, orgId), eq(schema.organizationmember.roleId, roleId)));

  return Number(row?.count ?? 0);
};

/**
 * Gets organization members of any role, so one screen can manage admins, tutors and
 * students together. Callers that still want only learners pass `roleIds: [ROLE.STUDENT]`.
 * Includes invited members without a profile (LEFT JOIN profile).
 * Row id is organizationmember.id; use profileId for profile-backed actions when present.
 */
type GetOrganizationAudienceOptions = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: TAudienceSortBy;
  sortOrder?: TAudienceSortOrder;
  /** Absent means every role. */
  roleIds?: number[];
  departmentId?: number;
  positionId?: number;
  /** `active` has a linked profile; `pending` is still an unaccepted invite. */
  status?: 'active' | 'pending';
};

export const getOrganizationAudience = async (orgId: string, options: GetOrganizationAudienceOptions = {}) => {
  const page = options.page && options.page > 0 ? options.page : 1;
  const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
  const offset = (page - 1) * limit;
  const search = options.search?.trim();
  const sortBy = options.sortBy ?? 'createdAt';
  const sortOrder = options.sortOrder ?? 'desc';

  const managerMember = alias(schema.organizationmember, 'manager_member');
  const managerProfile = alias(schema.profile, 'manager_profile');

  const audienceNameSql = sql<string>`COALESCE(
    NULLIF(${schema.profile.fullname}, ''),
    NULLIF(trim(concat_ws(' ', ${schema.organizationmember.firstName}, ${schema.organizationmember.lastName})), ''),
    ${schema.profile.email},
    ${schema.organizationmember.email}
  )`;
  const audienceEmailSql = sql<string>`COALESCE(${schema.profile.email}, ${schema.organizationmember.email})`;
  const audienceCreatedAtSql = sql<string>`COALESCE(${schema.profile.createdAt}, ${schema.organizationmember.createdAt})`;

  const conditions = [eq(schema.organizationmember.organizationId, orgId)];

  if (options.roleIds && options.roleIds.length > 0) {
    conditions.push(inArray(schema.organizationmember.roleId, options.roleIds));
  }

  if (options.departmentId) {
    conditions.push(eq(schema.organizationmember.departmentId, options.departmentId));
  }

  if (options.positionId) {
    conditions.push(eq(schema.organizationmember.positionId, options.positionId));
  }

  if (options.status === 'active') {
    conditions.push(isNotNull(schema.organizationmember.profileId));
  } else if (options.status === 'pending') {
    conditions.push(isNull(schema.organizationmember.profileId));
  }

  if (search) {
    const searchValue = `%${search}%`;
    conditions.push(
      or(
        ilike(schema.profile.fullname, searchValue),
        ilike(schema.profile.email, searchValue),
        ilike(schema.organizationmember.email, searchValue),
        ilike(schema.organizationmember.firstName, searchValue),
        ilike(schema.organizationmember.lastName, searchValue),
        ilike(schema.organizationPosition.name, searchValue),
        ilike(schema.organizationDepartment.name, searchValue)
      )!
    );
  }

  const whereClause = and(...conditions);
  const [totalRow] = await db
    .select({ count: count(schema.organizationmember.id) })
    .from(schema.organizationmember)
    .leftJoin(schema.profile, eq(schema.organizationmember.profileId, schema.profile.id))
    .leftJoin(schema.organizationPosition, eq(schema.organizationmember.positionId, schema.organizationPosition.id))
    .leftJoin(
      schema.organizationDepartment,
      eq(schema.organizationmember.departmentId, schema.organizationDepartment.id)
    )
    .where(whereClause);

  const total = Number(totalRow?.count ?? 0);

  const orderByExpression =
    sortBy === 'name'
      ? audienceNameSql
      : sortBy === 'email'
        ? audienceEmailSql
        : sortBy === 'role'
          ? schema.organizationmember.roleId
          : audienceCreatedAtSql;
  const orderedExpression = sortOrder === 'asc' ? asc(orderByExpression) : desc(orderByExpression);

  const result = await db
    .select({
      memberId: schema.organizationmember.id,
      roleId: schema.organizationmember.roleId,
      profileId: schema.profile.id,
      fullname: schema.profile.fullname,
      firstName: schema.organizationmember.firstName,
      lastName: schema.organizationmember.lastName,
      positionId: schema.organizationmember.positionId,
      positionName: schema.organizationPosition.name,
      departmentId: schema.organizationmember.departmentId,
      departmentName: schema.organizationDepartment.name,
      managerMemberId: schema.organizationmember.managerMemberId,
      managerEmail: sql<string | null>`coalesce(${managerProfile.email}, ${managerMember.email})`.as('managerEmail'),
      managerFullname: managerProfile.fullname,
      managerFirstName: managerMember.firstName,
      managerLastName: managerMember.lastName,
      email: audienceEmailSql.as('email'),
      avatarUrl: schema.profile.avatarUrl,
      profileCreatedAt: schema.profile.createdAt,
      memberCreatedAt: schema.organizationmember.createdAt
    })
    .from(schema.organizationmember)
    .leftJoin(schema.profile, eq(schema.organizationmember.profileId, schema.profile.id))
    .leftJoin(schema.organizationPosition, eq(schema.organizationmember.positionId, schema.organizationPosition.id))
    .leftJoin(
      schema.organizationDepartment,
      eq(schema.organizationmember.departmentId, schema.organizationDepartment.id)
    )
    .leftJoin(managerMember, eq(schema.organizationmember.managerMemberId, managerMember.id))
    .leftJoin(managerProfile, eq(managerMember.profileId, managerProfile.id))
    .where(whereClause)
    .orderBy(orderedExpression, desc(schema.organizationmember.id))
    .limit(limit)
    .offset(offset);

  return {
    items: result.map((row) => {
      const email = row.email?.trim() ?? '';
      const composedName = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
      const name = row.fullname?.trim() || composedName || (email.includes('@') ? email.split('@')[0] : email) || '';
      const createdAtRaw = row.profileId ? row.profileCreatedAt : row.memberCreatedAt;
      const createdAt = createdAtRaw ? new Date(createdAtRaw).toDateString() : '';
      const managerName =
        row.managerFullname?.trim() ||
        [row.managerFirstName, row.managerLastName].filter(Boolean).join(' ').trim() ||
        row.managerEmail?.trim() ||
        '';

      return {
        id: row.memberId,
        roleId: row.roleId,
        profileId: row.profileId ?? null,
        name,
        email,
        avatarUrl: row.avatarUrl || '',
        createdAt,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        jobTitle: row.positionName ?? null,
        position: row.positionId
          ? {
              id: row.positionId,
              name: row.positionName ?? ''
            }
          : null,
        department: row.departmentId
          ? {
              id: row.departmentId,
              name: row.departmentName ?? ''
            }
          : null,
        manager: row.managerMemberId
          ? {
              id: row.managerMemberId,
              email: row.managerEmail?.trim() ?? '',
              name: managerName
            }
          : null
      };
    }),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
};

/**
 * Student org member matched by profile email or organizationmember.email (for audience invite actions).
 */
export async function getStudentOrganizationMemberByOrgAndEmail(
  orgId: string,
  email: string
): Promise<{ id: number; profileId: string | null; email: string } | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) {
    return null;
  }

  try {
    const [row] = await db
      .select({
        id: schema.organizationmember.id,
        profileId: schema.organizationmember.profileId,
        displayEmail: sql<string>`COALESCE(${schema.profile.email}, ${schema.organizationmember.email})`.as(
          'displayEmail'
        )
      })
      .from(schema.organizationmember)
      .leftJoin(schema.profile, eq(schema.organizationmember.profileId, schema.profile.id))
      .where(
        and(
          eq(schema.organizationmember.organizationId, orgId),
          eq(schema.organizationmember.roleId, ROLE.STUDENT),
          or(eq(schema.organizationmember.email, normalized), eq(schema.profile.email, normalized))
        )
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      profileId: row.profileId,
      email: (row.displayEmail ?? normalized).trim()
    };
  } catch (error) {
    console.error('getStudentOrganizationMemberByOrgAndEmail error:', error);
    throw new Error(
      `Failed to get organization student member: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets organizations with optional filters
 * @param filters Filter options (siteName, customDomain, isCustomDomainVerified)
 * @returns Array of organizations with plans
 */
export const getOrganizations = async (filters?: {
  siteName?: string;
  customDomain?: string;
  isCustomDomainVerified?: boolean;
}): Promise<OrganizationWithPlans[]> => {
  const conditions: Parameters<typeof and>[0][] = [];

  if (filters?.siteName) {
    conditions.push(eq(schema.organization.siteName, filters.siteName));
  }

  if (filters?.customDomain) {
    const customDomainConditions: Parameters<typeof and>[0][] = [
      eq(schema.organization.customDomain, filters.customDomain)
    ];
    if (filters.isCustomDomainVerified !== undefined) {
      customDomainConditions.push(eq(schema.organization.isCustomDomainVerified, filters.isCustomDomainVerified));
    }
    conditions.push(and(...customDomainConditions));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({
      organization: schema.organization,
      plan: {
        planName: schema.organizationPlan.planName,
        isActive: schema.organizationPlan.isActive,
        provider: schema.organizationPlan.provider,
        subscriptionId: schema.organizationPlan.subscriptionId,
        customerId: sql`organization_plan.payload->>'customerId'`.as('customerId')
      }
    })
    .from(schema.organization)
    .leftJoin(schema.organizationPlan, eq(schema.organization.id, schema.organizationPlan.orgId))
    .where(whereClause);

  // Group by organization and collect plans into an array
  const organizationMap = new Map<
    string,
    {
      organization: typeof schema.organization.$inferSelect;
      plans: Array<OrganizationPlan>;
    }
  >();

  for (const row of result) {
    const orgId = row.organization.id;

    if (!organizationMap.has(orgId)) {
      organizationMap.set(orgId, {
        organization: row.organization,
        plans: []
      });
    }

    const orgData = organizationMap.get(orgId)!;

    // Add plan to array if it exists (not null)
    if (
      row.plan &&
      (row.plan.planName !== null ||
        row.plan.isActive !== null ||
        row.plan.provider !== null ||
        row.plan.subscriptionId !== null)
    ) {
      orgData.plans.push({
        planName: row.plan.planName,
        isActive: row.plan.isActive,
        provider: row.plan.provider,
        subscriptionId: row.plan.subscriptionId,
        customerId: row.plan.customerId as string | null
      });
    }
  }

  return Array.from(organizationMap.values()).map(({ organization, plans }) => ({
    ...(organization as TOrganization),
    plans
  }));
};

/**
 * Gets free (BASIC) plan organizations whose active student count exceeds
 * `limit`, in a single query. Free = no active paid plan. Used by maintenance
 * jobs so they don't load every org (or every org's count) and filter in memory.
 */
export const getFreePlanOrganizationsOverStudentLimit = async (
  limit: number
): Promise<Array<TOrganization & { studentCount: number }>> => {
  try {
    const paidPlans = [PLAN.EARLY_ADOPTER, PLAN.ENTERPRISE] as ('EARLY_ADOPTER' | 'ENTERPRISE')[];
    const paidOrgIds = db
      .select({ orgId: schema.organizationPlan.orgId })
      .from(schema.organizationPlan)
      .where(and(eq(schema.organizationPlan.isActive, true), inArray(schema.organizationPlan.planName, paidPlans)));

    const studentCount = count(schema.organizationmember.id);
    const rows = await db
      .select({ organization: schema.organization, studentCount })
      .from(schema.organization)
      .innerJoin(
        schema.organizationmember,
        and(
          eq(schema.organizationmember.organizationId, schema.organization.id),
          eq(schema.organizationmember.roleId, ROLE.STUDENT)
        )
      )
      .where(notInArray(schema.organization.id, paidOrgIds))
      .groupBy(schema.organization.id)
      .having(gt(studentCount, limit));

    return rows.map((row) => ({ ...(row.organization as TOrganization), studentCount: Number(row.studentCount) }));
  } catch (error) {
    console.error('getFreePlanOrganizationsOverStudentLimit error:', error);
    throw new Error('Failed to load free-plan organizations over the student limit');
  }
};

/**
 * Resolves the self-hosted primary organization id.
 * Celluloplast V1 prefers the celluloplast tenant over upstream demo orgs that may share createdAt.
 */
const resolveSelfHostedPrimaryOrgId = async (): Promise<string | null> => {
  const [bySiteName] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.siteName, CELLULOPLAST_PRIMARY_ORG.siteName))
    .limit(1);

  if (bySiteName) {
    return bySiteName.id;
  }

  const [byId] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.id, CELLULOPLAST_PRIMARY_ORG_ID))
    .limit(1);

  if (byId) {
    return byId.id;
  }

  const [firstOrg] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .orderBy(schema.organization.createdAt)
    .limit(1);

  return firstOrg?.id ?? null;
};

/**
 * Gets the first (and typically only) organization - used for self-hosted single-org mode
 * @returns Primary Celluloplast organization when present, otherwise first by createdAt
 */
export const getFirstOrganization = async (): Promise<TOrganization | null> => {
  const orgId = await resolveSelfHostedPrimaryOrgId();
  if (!orgId) {
    return null;
  }

  const [organization] = await db.select().from(schema.organization).where(eq(schema.organization.id, orgId)).limit(1);

  return organization || null;
};

/**
 * Gets the first organization with plans - for self-hosted single-org mode
 * @returns Primary organization with plans (Celluloplast when present), or null if none exist
 */
export const getFirstOrganizationWithPlans = async (): Promise<
  (TOrganization & { plans: Array<OrganizationPlan> }) | null
> => {
  const orgId = await resolveSelfHostedPrimaryOrgId();
  if (!orgId) {
    return null;
  }

  const result = await db
    .select({
      organization: schema.organization,
      plan: {
        planName: schema.organizationPlan.planName,
        isActive: schema.organizationPlan.isActive,
        provider: schema.organizationPlan.provider,
        subscriptionId: schema.organizationPlan.subscriptionId,
        customerId: sql`organization_plan.payload->>'customerId'`.as('customerId')
      }
    })
    .from(schema.organization)
    .leftJoin(schema.organizationPlan, eq(schema.organization.id, schema.organizationPlan.orgId))
    .where(eq(schema.organization.id, orgId));

  const organizationMap = new Map<
    string,
    {
      organization: typeof schema.organization.$inferSelect;
      plans: Array<OrganizationPlan>;
    }
  >();

  for (const row of result) {
    const orgId = row.organization.id;
    if (!organizationMap.has(orgId)) {
      organizationMap.set(orgId, {
        organization: row.organization,
        plans: []
      });
    }
    const orgData = organizationMap.get(orgId)!;
    if (
      row.plan &&
      (row.plan.planName !== null ||
        row.plan.isActive !== null ||
        row.plan.provider !== null ||
        row.plan.subscriptionId !== null)
    ) {
      orgData.plans.push({
        planName: row.plan.planName,
        isActive: row.plan.isActive,
        provider: row.plan.provider,
        subscriptionId: row.plan.subscriptionId,
        customerId: row.plan.customerId as string | null
      });
    }
  }

  const first = Array.from(organizationMap.values())[0];
  return first
    ? ({
        ...(first.organization as TOrganization),
        plans: first.plans
      } as TOrganization & { plans: Array<OrganizationPlan> })
    : null;
};

/**
 * Gets the number of organizations - used for self-hosted to block org creation when org exists
 * @returns Count of organizations
 */
export const getOrganizationCount = async (): Promise<number> => {
  const [result] = await db.select({ count: sql<number>`count(*)::int`.as('count') }).from(schema.organization);

  return result?.count ?? 0;
};

/**
 * Creates a new organization plan
 * @param data Organization plan creation data
 * @param dbClient Optional DB or transaction client for use within transactions
 * @returns Created organization plan record
 */
export const getOrganizationPlanBySubscriptionId = async (
  subscriptionId: string,
  dbClient: DbOrTxClient = db
): Promise<TOrganizationPlan | null> => {
  try {
    const [plan] = await dbClient
      .select()
      .from(schema.organizationPlan)
      .where(eq(schema.organizationPlan.subscriptionId, subscriptionId))
      .limit(1);

    return plan ?? null;
  } catch (error) {
    console.error('getOrganizationPlanBySubscriptionId error:', error);
    throw new Error(`Failed to fetch organization plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Gets every active organization plan that has a Polar subscription ID attached.
 * Used by one-off backfills that need to re-verify subscription status against Polar.
 * @param dbClient Optional DB or transaction client for use within transactions
 * @returns Active organization plans with org name/siteName for readable logging
 */
export const getActiveOrganizationPlansWithSubscription = async (
  dbClient: DbOrTxClient = db
): Promise<Array<TOrganizationPlan & { orgName: string; orgSiteName: string | null }>> => {
  try {
    return await dbClient
      .select({
        ...getTableColumns(schema.organizationPlan),
        orgName: schema.organization.name,
        orgSiteName: schema.organization.siteName
      })
      .from(schema.organizationPlan)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.organizationPlan.orgId))
      .where(and(eq(schema.organizationPlan.isActive, true), isNotNull(schema.organizationPlan.subscriptionId)));
  } catch (error) {
    console.error('getActiveOrganizationPlansWithSubscription error:', error);
    throw new Error(
      `Failed to fetch active organization plans: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export const createOrganizationPlan = async (
  data: TNewOrganizationPlan,
  dbClient: DbOrTxClient = db
): Promise<TOrganizationPlan> => {
  const [plan] = await dbClient.insert(schema.organizationPlan).values(data).returning();
  return plan;
};

/**
 * Updates an organization plan by subscription ID
 * @param subscriptionId Subscription ID
 * @param payload Payload data to update
 * @returns Updated organization plan record
 */
export const updateOrganizationPlan = async (
  subscriptionId: string,
  payload: TOrganizationPlan['payload']
): Promise<TOrganizationPlan> => {
  const [plan] = await db
    .update(schema.organizationPlan)
    .set({ payload, updatedAt: sql`timezone('utc'::text, now())` })
    .where(eq(schema.organizationPlan.subscriptionId, subscriptionId))
    .returning();
  return plan;
};

/**
 * Cancels an organization plan by subscription ID
 * @param subscriptionId Subscription ID
 * @param payload Payload data to update
 * @returns Updated organization plan record
 */
export const cancelOrganizationPlan = async (
  subscriptionId: string,
  payload: TOrganizationPlan['payload']
): Promise<TOrganizationPlan> => {
  const [plan] = await db
    .update(schema.organizationPlan)
    .set({
      isActive: false,
      deactivatedAt: sql`timezone('utc'::text, now())`,
      payload,
      updatedAt: sql`timezone('utc'::text, now())`
    })
    .where(eq(schema.organizationPlan.subscriptionId, subscriptionId))
    .returning();

  return plan;
};

/**
 * Updates an organization
 * @param id Organization ID
 * @param data Partial organization data to update. When `settings` is provided, it is deep-merged with existing settings.
 * @returns Updated organization record
 */
export const updateOrganization = async (id: string, data: Partial<TOrganization>): Promise<TOrganization> => {
  let setData = { ...data };

  if (data.settings !== undefined) {
    const [existing] = await db
      .select({ settings: schema.organization.settings })
      .from(schema.organization)
      .where(eq(schema.organization.id, id))
      .limit(1);

    const existingSettings = (existing?.settings as Record<string, unknown>) ?? {};
    const newSettings = data.settings as Record<string, unknown>;
    const mergedSettings: Record<string, unknown> = { ...existingSettings };
    for (const key of Object.keys(newSettings ?? {})) {
      const existingVal = existingSettings[key];
      const newVal = newSettings[key];
      if (newVal !== undefined) {
        // Certificate design is a complete document — replace rather than shallow-merge
        // so nested signatories / optional fields cannot leave stale values behind.
        if (key === 'certificateDesign') {
          mergedSettings[key] = newVal;
        } else if (
          existingVal &&
          typeof existingVal === 'object' &&
          !Array.isArray(existingVal) &&
          newVal &&
          typeof newVal === 'object' &&
          !Array.isArray(newVal)
        ) {
          mergedSettings[key] = { ...(existingVal as Record<string, unknown>), ...(newVal as Record<string, unknown>) };
        } else {
          mergedSettings[key] = newVal;
        }
      }
    }
    setData = { ...setData, settings: mergedSettings as TOrganization['settings'] };
  }

  const [organization] = await db
    .update(schema.organization)
    .set(setData)
    .where(eq(schema.organization.id, id))
    .returning();

  return organization;
};

/**
 * Get organization plan status for SSO entitlement check
 * @param orgId Organization ID
 * @returns Array of plan records
 */
export const getOrganizationPlanStatus = async (orgId: string) => {
  const result = await db
    .select({
      planName: schema.organizationPlan.planName,
      isActive: schema.organizationPlan.isActive
    })
    .from(schema.organizationPlan)
    .where(eq(schema.organizationPlan.orgId, orgId));

  return result;
};

export const getActiveOrganizationPlan = async (orgId: string) => {
  const [plan] = await db
    .select()
    .from(schema.organizationPlan)
    .where(and(eq(schema.organizationPlan.orgId, orgId), eq(schema.organizationPlan.isActive, true)))
    .limit(1);

  if (plan) return plan;

  // Secondary workspaces inherit their primary's plan.
  const [org] = await db
    .select({ parentOrganizationId: schema.organization.parentOrganizationId })
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId))
    .limit(1);

  if (!org?.parentOrganizationId) return null;

  const [parentPlan] = await db
    .select()
    .from(schema.organizationPlan)
    .where(and(eq(schema.organizationPlan.orgId, org.parentOrganizationId), eq(schema.organizationPlan.isActive, true)))
    .limit(1);

  return parentPlan ?? null;
};

/**
 * Gets organization members by profile IDs
 * @param orgId Organization ID
 * @param profileIds Array of profile IDs to look up
 * @returns Array of { profileId, email } for matching members
 */
export async function getOrgMembersByProfileIds(orgId: string, profileIds: string[]) {
  try {
    if (profileIds.length === 0) return [];

    // memberId, job title and department come along so callers can decide course eligibility
    // without a second round trip.
    return db
      .select({
        memberId: schema.organizationmember.id,
        profileId: schema.organizationmember.profileId,
        email: schema.organizationmember.email,
        roleId: schema.organizationmember.roleId,
        jobTitle: schema.organizationPosition.name,
        department: schema.organizationDepartment.name
      })
      .from(schema.organizationmember)
      .leftJoin(schema.organizationPosition, eq(schema.organizationmember.positionId, schema.organizationPosition.id))
      .leftJoin(
        schema.organizationDepartment,
        eq(schema.organizationmember.departmentId, schema.organizationDepartment.id)
      )
      .where(
        and(
          eq(schema.organizationmember.organizationId, orgId),
          inArray(schema.organizationmember.profileId, profileIds)
        )
      );
  } catch (error) {
    console.error('getOrgMembersByProfileIds error:', error);
    throw new Error(
      `Failed to get org members by profile IDs: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export type TOrganizationMemberByEmail = {
  id: number;
  normalizedEmail: string;
  profileId: string | null;
  roleId: number;
};

/**
 * Resolves organization members matching normalized emails (profile email or organizationmember.email).
 */
export async function getOrganizationMembersByNormalizedEmails(
  orgId: string,
  emails: string[]
): Promise<TOrganizationMemberByEmail[]> {
  try {
    if (emails.length === 0) return [];

    const normalized = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))];

    const rows = await db
      .select({
        id: schema.organizationmember.id,
        roleId: schema.organizationmember.roleId,
        profileId: schema.organizationmember.profileId,
        matchEmail: sql<string>`lower(trim(coalesce(${schema.profile.email}, ${schema.organizationmember.email})))`.as(
          'matchEmail'
        )
      })
      .from(schema.organizationmember)
      .leftJoin(schema.profile, eq(schema.organizationmember.profileId, schema.profile.id))
      .where(
        and(
          eq(schema.organizationmember.organizationId, orgId),
          inArray(sql`lower(trim(coalesce(${schema.profile.email}, ${schema.organizationmember.email})))`, normalized)
        )
      );

    return rows.map((row) => ({
      id: row.id,
      normalizedEmail: row.matchEmail,
      profileId: row.profileId,
      roleId: row.roleId
    }));
  } catch (error) {
    console.error('getOrganizationMembersByNormalizedEmails error:', error);
    throw new Error(
      `Failed to get organization members by emails: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export type TOrganizationMemberForAudienceAssignment = {
  memberId: number;
  profileId: string | null;
  email: string;
  jobTitle: string | null;
  department: string | null;
};

export async function getOrganizationAudienceFilterOptions(orgId: string): Promise<{
  jobTitles: string[];
  departments: string[];
}> {
  try {
    const [jobTitleRows, departmentRows] = await Promise.all([
      db
        .select({ value: schema.organizationPosition.name })
        .from(schema.organizationPosition)
        .where(eq(schema.organizationPosition.organizationId, orgId))
        .orderBy(asc(schema.organizationPosition.name)),
      db
        .select({ value: schema.organizationDepartment.name })
        .from(schema.organizationDepartment)
        .where(eq(schema.organizationDepartment.organizationId, orgId))
        .orderBy(asc(schema.organizationDepartment.name))
    ]);

    return {
      jobTitles: jobTitleRows.map((row) => row.value.trim()).filter(Boolean),
      departments: departmentRows.map((row) => row.value.trim()).filter(Boolean)
    };
  } catch (error) {
    console.error('getOrganizationAudienceFilterOptions error:', error);
    throw new Error(
      `Failed to get audience filter options: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function getOrganizationMembersForAudienceAssignment(
  orgId: string,
  filters: {
    mode: TCourseAudienceAssignmentMode;
    memberIds?: number[];
    jobTitles?: string[];
    departments?: string[];
  }
): Promise<TOrganizationMemberForAudienceAssignment[]> {
  try {
    const conditions = [
      eq(schema.organizationmember.organizationId, orgId),
      eq(schema.organizationmember.roleId, ROLE.STUDENT)
    ];

    if (filters.mode === 'members') {
      const memberIds = filters.memberIds ?? [];
      if (memberIds.length === 0) {
        return [];
      }
      conditions.push(inArray(schema.organizationmember.id, memberIds));
    }

    if (filters.mode === 'jobTitles') {
      const normalizedTitles = (filters.jobTitles ?? []).map((title) => title.toLowerCase().trim()).filter(Boolean);
      if (normalizedTitles.length === 0) {
        return [];
      }
      conditions.push(inArray(sql`lower(trim(${schema.organizationPosition.name}))`, normalizedTitles));
    }

    if (filters.mode === 'departments') {
      const normalizedDepartments = (filters.departments ?? [])
        .map((dept) => dept.toLowerCase().trim())
        .filter(Boolean);
      if (normalizedDepartments.length === 0) {
        return [];
      }
      conditions.push(inArray(sql`lower(trim(${schema.organizationDepartment.name}))`, normalizedDepartments));
    }

    const rows = await db
      .select({
        memberId: schema.organizationmember.id,
        profileId: schema.organizationmember.profileId,
        email: sql<string>`coalesce(${schema.profile.email}, ${schema.organizationmember.email})`.as('email'),
        jobTitle: schema.organizationPosition.name,
        department: schema.organizationDepartment.name
      })
      .from(schema.organizationmember)
      .leftJoin(schema.profile, eq(schema.organizationmember.profileId, schema.profile.id))
      .leftJoin(schema.organizationPosition, eq(schema.organizationmember.positionId, schema.organizationPosition.id))
      .leftJoin(
        schema.organizationDepartment,
        eq(schema.organizationmember.departmentId, schema.organizationDepartment.id)
      )
      .where(and(...conditions));

    return rows.map((row) => ({
      memberId: row.memberId,
      profileId: row.profileId ?? null,
      email: row.email?.trim() ?? '',
      jobTitle: row.jobTitle ?? null,
      department: row.department ?? null
    }));
  } catch (error) {
    console.error('getOrganizationMembersForAudienceAssignment error:', error);
    throw new Error(
      `Failed to get members for audience assignment: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
