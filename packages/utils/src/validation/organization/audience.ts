import * as z from 'zod';

export const AudienceSortBy = z.enum(['createdAt', 'name', 'email']);
export const AudienceSortOrder = z.enum(['asc', 'desc']);

export const ZGetAudienceQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: AudienceSortBy.default('createdAt'),
  sortOrder: AudienceSortOrder.default('desc')
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
    managerMemberId: z.coerce.number().int().positive().optional(),
    managerEmail: z.email().optional(),
    courseIds: z.array(z.string().uuid()).optional(),
    cohortIds: z.array(z.string().uuid()).optional(),
    sendEmail: z.boolean().default(true)
  })
  .refine((data) => !(data.managerMemberId && data.managerEmail), {
    message: 'Provide either managerMemberId or managerEmail, not both',
    path: ['managerEmail']
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
