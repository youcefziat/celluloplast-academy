import * as z from 'zod';

export const AudienceSortBy = z.enum(['createdAt', 'name', 'email', 'role']);
export const AudienceSortOrder = z.enum(['asc', 'desc']);

/** ADMIN, TUTOR or STUDENT — mirrors ROLE in @cio/utils/constants/roles. */
export const ZOrganizationRoleId = z.coerce
  .number()
  .int()
  .refine((value) => value === 1 || value === 2 || value === 3, {
    message: 'Role must be admin, tutor or student'
  });

/** A member is `active` once a profile is linked, otherwise the invite is still pending. */
export const AudienceStatus = z.enum(['active', 'pending']);

export const ZGetAudienceQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: AudienceSortBy.default('createdAt'),
  sortOrder: AudienceSortOrder.default('desc'),
  /** Repeatable in the query string; absent means every role. */
  roleIds: z
    .union([ZOrganizationRoleId, z.array(ZOrganizationRoleId)])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;

      return Array.isArray(value) ? value : [value];
    }),
  departmentId: z.coerce.number().int().positive().optional(),
  positionId: z.coerce.number().int().positive().optional(),
  status: AudienceStatus.optional()
});

export type TAudienceSortBy = z.infer<typeof AudienceSortBy>;
export type TAudienceSortOrder = z.infer<typeof AudienceSortOrder>;
export type TGetAudienceQuery = z.infer<typeof ZGetAudienceQuery>;

const optionalTrimmedString = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const ZAudienceMemberHrFields = z.object({
  firstName: optionalTrimmedString,
  lastName: optionalTrimmedString,
  jobTitle: optionalTrimmedString,
  department: optionalTrimmedString
});

export const ZCreateAudienceMember = z
  .object({
    email: z.email(),
    firstName: optionalTrimmedString,
    lastName: optionalTrimmedString,
    jobTitle: optionalTrimmedString,
    department: optionalTrimmedString,
    positionId: z.coerce.number().int().positive().optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    managerMemberId: z.coerce.number().int().positive().optional(),
    managerEmail: z.email().optional(),
    courseIds: z.array(z.string().uuid()).optional(),
    cohortIds: z.array(z.string().uuid()).optional(),
    /**
     * Which role the member is created with. Defaults to student so existing callers,
     * including the CSV import, keep their behaviour.
     */
    roleId: ZOrganizationRoleId.default(3),
    sendEmail: z.boolean().default(true),
    /**
     * cPanel/Office 365 migration coexistence: deliver the invite email to
     * `<local-part>@celluloplast.onmicrosoft.com` instead of the entered address. The account's
     * email is unaffected — only where the invite is delivered changes.
     */
    office365: z.boolean().default(false)
  })
  .refine((data) => !(data.managerMemberId && data.managerEmail), {
    message: 'Provide either managerMemberId or managerEmail, not both',
    path: ['managerEmail']
  })
  .refine((data) => !(data.positionId && data.jobTitle), {
    message: 'Provide either positionId or jobTitle, not both',
    path: ['jobTitle']
  })
  .refine((data) => !(data.departmentId && data.department), {
    message: 'Provide either departmentId or department, not both',
    path: ['department']
  });

export type TCreateAudienceMember = z.infer<typeof ZCreateAudienceMember>;

export const ZAudienceImportRow = z.object({
  email: z.email(),
  firstName: optionalTrimmedString,
  lastName: optionalTrimmedString,
  jobTitle: optionalTrimmedString,
  department: optionalTrimmedString,
  managerEmail: optionalTrimmedString
});

export type TAudienceImportRow = z.infer<typeof ZAudienceImportRow>;

export const ZImportAudienceMembers = z
  .object({
    recipientCsv: z.string().max(25000).optional(),
    rows: z.array(ZAudienceImportRow).max(500).optional(),
    courseIds: z.array(z.string().uuid()).optional(),
    cohortIds: z.array(z.string().uuid()).optional(),
    allCourses: z.boolean().optional().default(false),
    allCohorts: z.boolean().optional().default(false),
    sendEmail: z.boolean().default(true)
  })
  .refine((data) => Boolean(data.recipientCsv?.trim()) || (data.rows?.length ?? 0) > 0, {
    message: 'Provide recipientCsv or rows',
    path: ['rows']
  });

export type TImportAudienceMembers = z.infer<typeof ZImportAudienceMembers>;

export const ZAssignAudienceCourses = z
  .object({
    profileIds: z.array(z.uuid()).min(1).max(500),
    courseIds: z.array(z.uuid()).optional(),
    cohortIds: z.array(z.uuid()).optional(),
    sendEmail: z.boolean().default(true)
  })
  .refine((data) => (data.courseIds?.length ?? 0) > 0 || (data.cohortIds?.length ?? 0) > 0, {
    message: 'At least one course or cohort must be selected',
    path: ['courseIds']
  });

export type TAssignAudienceCourses = z.infer<typeof ZAssignAudienceCourses>;

export const ZAudienceInviteByEmail = z.object({
  email: z.email()
});

export type TAudienceInviteByEmail = z.infer<typeof ZAudienceInviteByEmail>;

/**
 * Editing an existing member. Every field is optional so the form can send only what changed;
 * `email` is absent on purpose — it is the account identity and has its own flow for pending
 * invites (`updatePendingAudienceMemberEmail`).
 */
export const ZUpdateAudienceMember = z
  .object({
    firstName: optionalTrimmedString,
    lastName: optionalTrimmedString,
    jobTitle: optionalTrimmedString,
    department: optionalTrimmedString,
    positionId: z.coerce.number().int().positive().nullable().optional(),
    departmentId: z.coerce.number().int().positive().nullable().optional(),
    managerMemberId: z.coerce.number().int().positive().nullable().optional(),
    managerEmail: z.email().optional(),
    roleId: ZOrganizationRoleId.optional()
  })
  .refine((data) => !(data.managerMemberId && data.managerEmail), {
    message: 'Provide either managerMemberId or managerEmail, not both',
    path: ['managerEmail']
  })
  .refine((data) => !(data.positionId && data.jobTitle), {
    message: 'Provide either positionId or jobTitle, not both',
    path: ['jobTitle']
  });

export type TUpdateAudienceMember = z.infer<typeof ZUpdateAudienceMember>;

export const ZAudienceMemberParam = z.object({
  memberId: z.coerce.number().int().positive()
});

export type TAudienceMemberParam = z.infer<typeof ZAudienceMemberParam>;
