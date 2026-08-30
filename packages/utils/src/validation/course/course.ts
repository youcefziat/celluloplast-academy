import * as z from 'zod';

import { toFiniteNumber } from '../../functions/number';
import { ALLOWED_CONTENT_TYPES, ALLOWED_DOCUMENT_TYPES, isDocumentFileNameCompatibleWithMimeType } from '../constants';
import { ZCourseCalloutInput } from './callout';
import { ZCourseType } from './course-type';

export const ZGetRecommendedCourses = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).optional(),
  page: z.string().transform(Number).pipe(z.number().min(1)).optional()
});
export type TGetRecommendedCourses = z.infer<typeof ZGetRecommendedCourses>;

export const ZCourseClone = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  slug: z.string().min(1),
  organizationId: z.string().min(1)
});
export type TCourseClone = z.infer<typeof ZCourseClone>;

export const ZCourseCloneParam = z.object({
  courseId: z.string().min(1)
});
export type TCourseCloneParam = z.infer<typeof ZCourseCloneParam>;

export const ZCourseGetParam = z.object({
  courseId: z.string().min(1)
});
export type TCourseGetParam = z.infer<typeof ZCourseGetParam>;

export const ZCourseGetQuery = z.object({
  slug: z.string().optional()
});
export type TCourseGetQuery = z.infer<typeof ZCourseGetQuery>;

export const ZCourseGetBySlugParam = z.object({
  slug: z.string().min(1)
});
export type TCourseGetBySlugParam = z.infer<typeof ZCourseGetBySlugParam>;

export const ZCourseEnrollParam = z.object({
  courseId: z.string().min(1)
});
export type TCourseEnrollParam = z.infer<typeof ZCourseEnrollParam>;

export const ZCourseEnrollBody = z.object({
  inviteToken: z.string().min(1).optional()
});
export type TCourseEnrollBody = z.infer<typeof ZCourseEnrollBody>;

export const ZCourseDownloadParam = z.object({
  courseId: z.string().min(1)
});
export type TCourseDownloadParam = z.infer<typeof ZCourseDownloadParam>;

/** Legacy certificate design schema kept only for reading historical course data. */
export const ZCertificateSignatory = z.object({
  name: z.string().max(80).default(''),
  role: z.string().max(80).default(''),
  enabled: z.boolean().default(true),
  signatureUrl: z.url().optional()
});
export type TCertificateSignatory = z.infer<typeof ZCertificateSignatory>;

export const ZCertificateTemplateId = z.enum(['classique', 'brutalist', 'noir', 'poster', 'minimal']);
export type TCertificateTemplateId = z.infer<typeof ZCertificateTemplateId>;

export const ZCertificateDesign = z.object({
  templateId: ZCertificateTemplateId,
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: 'Accent must be a 6-digit hex color' }),
  subtitle: z.string().max(120).optional(),
  descriptionOverride: z.string().max(500).optional(),
  logoUrl: z.url().optional(),
  signatories: z.tuple([ZCertificateSignatory, ZCertificateSignatory]),
  idFormat: z.string().max(40).optional()
});
export type TCertificateDesign = z.infer<typeof ZCertificateDesign>;

export const ZCertificateFontFamily = z.enum([
  'inter',
  'cormorant-garamond',
  'cinzel',
  'playfair-display',
  'space-grotesk',
  'dm-mono'
]);
export const ZCertificateVariable = z.enum([
  'student.fullName',
  'student.firstName',
  'student.lastName',
  'student.email',
  'course.name',
  'course.description',
  'certificate.date',
  'certificate.id',
  'organization.name'
]);
const ZCertificateImageUrl = z.url().refine((value) => /^https?:\/\//i.test(value), {
  message: 'Certificate images must use HTTP or HTTPS'
});
const ZCertificateElementBase = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  x: z.number().finite().min(-1100).max(2200),
  y: z.number().finite().min(-780).max(1560),
  width: z.number().finite().min(8).max(2200),
  height: z.number().finite().min(8).max(1560),
  rotation: z.number().finite().min(-360).max(360),
  opacity: z.number().finite().min(0).max(1),
  zIndex: z.number().int().min(0).max(1000),
  locked: z.boolean().optional()
});
const ZCertificateTextStyle = z.object({
  fontFamily: ZCertificateFontFamily,
  fontSize: z.number().finite().min(6).max(240),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
  fontStyle: z.enum(['normal', 'italic']),
  textAlign: z.enum(['left', 'center', 'right']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  lineHeight: z.number().finite().min(0.7).max(3)
});
export const ZCertificateTextElement = ZCertificateElementBase.extend({
  type: z.literal('text'),
  text: z.string().max(2000),
  ...ZCertificateTextStyle.shape
});
export const ZCertificateVariableElement = ZCertificateElementBase.extend({
  type: z.literal('variable'),
  variable: ZCertificateVariable,
  ...ZCertificateTextStyle.shape
});
export const ZCertificateImageElement = ZCertificateElementBase.extend({
  type: z.literal('image'),
  role: z.enum(['logo', 'signature', 'image']),
  src: ZCertificateImageUrl.optional(),
  objectFit: z.enum(['contain', 'cover']),
  keepRatio: z.boolean()
});
export const ZCertificateLayoutElement = z.discriminatedUnion('type', [
  ZCertificateTextElement,
  ZCertificateVariableElement,
  ZCertificateImageElement
]);
export const ZCertificateLayout = z.object({
  version: z.literal(1),
  page: z.object({
    width: z.literal(1100),
    height: z.literal(780),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    backgroundImageUrl: ZCertificateImageUrl.optional(),
    backgroundImageOpacity: z.number().finite().min(0).max(1).optional()
  }),
  elements: z.array(ZCertificateLayoutElement).max(100),
  certificateIdFormat: z.string().max(40).optional(),
  sourcePresetId: ZCertificateTemplateId.optional()
});
export type TCertificateLayout = z.infer<typeof ZCertificateLayout>;

/** Organization settings accept historical designs until they are saved in the visual editor. */
export const ZCertificateOrganizationDesign = z.union([ZCertificateLayout, ZCertificateDesign]);
export type TCertificateOrganizationDesign = z.infer<typeof ZCertificateOrganizationDesign>;

/**
 * Body for `POST /:courseId/download/certificate(/png)`.
 * The server reads design + course + org from the DB; the client only sends
 * the per-recipient fields it cannot infer.
 */
export const ZCertificateDownloadRequest = z.object({
  studentName: z.string().min(1).max(120),
  studentId: z.string().min(1).max(64).optional(),
  issuedAt: z.preprocess((value) => {
    if (typeof value !== 'string' || value.trim() === '') return undefined;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;

    return parsed.toISOString();
  }, z.string().datetime().optional()),
  /** When true, skips the eligibility check (course owner previewing their own design). */
  previewMode: z.boolean().optional()
});
export type TCertificateDownloadRequest = z.infer<typeof ZCertificateDownloadRequest>;

export const ZCourseDownloadContent = z.object({
  courseTitle: z.string().min(1),
  orgName: z.string().min(1),
  orgTheme: z.string().min(1),
  lessons: z.array(
    z.object({
      lessonTitle: z.string().min(1),
      lessonNumber: z.string().min(1),
      lessonNote: z.string(),
      slideUrl: z.string().url().optional(),
      video: z.array(z.string().url()).optional()
    })
  )
});
export type TCourseDownloadContent = z.infer<typeof ZCourseDownloadContent>;

export const ZLessonDownloadContent = z.object({
  title: z.string().min(1),
  number: z.string().min(1),
  orgName: z.string().min(1),
  note: z.string(),
  slideUrl: z.string().url().optional(),
  video: z.array(z.string().url()).optional(),
  courseTitle: z.string().min(1)
});
export type TLessonDownloadContent = z.infer<typeof ZLessonDownloadContent>;

export const ZCoursePresignUrlUpload = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(ALLOWED_CONTENT_TYPES),
  fileSize: z.number().int().min(0).optional()
});
export type TCoursePresignUrlUpload = z.infer<typeof ZCoursePresignUrlUpload>;

export const ZCourseDocumentPresignUrlUpload = z
  .object({
    fileName: z.string().min(1),
    fileType: z.enum(ALLOWED_DOCUMENT_TYPES),
    fileSize: z.number().int().min(0).optional()
  })
  .superRefine((value, ctx) => {
    if (!isDocumentFileNameCompatibleWithMimeType(value.fileName, value.fileType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Document filename extension does not match its MIME type',
        path: ['fileName']
      });
    }
  });
export type TCourseDocumentPresignUrlUpload = z.infer<typeof ZCourseDocumentPresignUrlUpload>;

export const ZCourseDownloadPresignedUrl = z.object({
  keys: z.array(z.string().min(1)).min(1)
});
export type TCourseDownloadPresignedUrl = z.infer<typeof ZCourseDownloadPresignedUrl>;

export const ZCourseContentUpdateItem = z.object({
  id: z.string().min(1),
  type: z.enum(['LESSON', 'EXERCISE']),
  isUnlocked: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  sectionId: z.string().nullable().optional()
});
export type TCourseContentUpdateItem = z.infer<typeof ZCourseContentUpdateItem>;

export const ZCourseContentUpdate = z.object({
  items: z.array(ZCourseContentUpdateItem).min(1)
});
export type TCourseContentUpdate = z.infer<typeof ZCourseContentUpdate>;

export const ZCourseContentReorderSection = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0)
});
export type TCourseContentReorderSection = z.infer<typeof ZCourseContentReorderSection>;

export const ZCourseContentReorderItem = ZCourseContentUpdateItem.omit({
  isUnlocked: true
});
export type TCourseContentReorderItem = z.infer<typeof ZCourseContentReorderItem>;

export const ZCourseContentReorderBase = z.object({
  sections: z.array(ZCourseContentReorderSection).min(1).optional(),
  items: z.array(ZCourseContentReorderItem).min(1).optional()
});
export type TCourseContentReorderBase = z.infer<typeof ZCourseContentReorderBase>;

export const ZCourseContentReorder = ZCourseContentReorderBase.superRefine((data, ctx) => {
  if (!data.sections?.length && !data.items?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sections'],
      message: 'Provide sections or items to reorder'
    });
  }

  const sectionIds = new Set<string>();
  data.sections?.forEach((section, index) => {
    if (sectionIds.has(section.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sections', index, 'id'],
        message: 'Section IDs must be unique'
      });
    }

    sectionIds.add(section.id);
  });

  const itemKeys = new Set<string>();
  data.items?.forEach((item, index) => {
    if (item.order === undefined && item.sectionId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items', index],
        message: 'Each item must provide order or sectionId'
      });
    }

    const itemKey = `${item.type}:${item.id}`;
    if (itemKeys.has(itemKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items', index, 'id'],
        message: 'Item IDs must be unique per content type'
      });
    }

    itemKeys.add(itemKey);
  });
});
export type TCourseContentReorder = z.infer<typeof ZCourseContentReorder>;

export const ZCourseContentDeleteItem = z.object({
  id: z.string().min(1),
  type: z.enum(['LESSON', 'EXERCISE'])
});
export type TCourseContentDeleteItem = z.infer<typeof ZCourseContentDeleteItem>;

export const ZCourseContentDelete = z
  .object({
    sectionId: z.string().min(1).optional(),
    items: z.array(ZCourseContentDeleteItem).min(1).optional()
  })
  .superRefine((data, ctx) => {
    if (Boolean(data.sectionId) === Boolean(data.items)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sectionId'],
        message: 'Provide either sectionId or items'
      });
    }

    const itemKeys = new Set<string>();
    data.items?.forEach((item, index) => {
      const itemKey = `${item.type}:${item.id}`;
      if (itemKeys.has(itemKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'id'],
          message: 'Item IDs must be unique per content type'
        });
      }

      itemKeys.add(itemKey);
    });
  });
export type TCourseContentDelete = z.infer<typeof ZCourseContentDelete>;

export const ZComplianceSettings = z.object({
  retakeIntervalMonths: z.number().int().min(1).max(120),
  gracePeriodDays: z.number().int().min(0).max(365).optional().default(0),
  reminderDaysBefore: z.array(z.number().int().min(1).max(365)).max(10).optional().default([30, 7, 1]),
  isMandatory: z.boolean().optional().default(true),
  framework: z.enum(['HIPAA', 'OSHA', 'SOX', 'GDPR', 'PCI_DSS', 'FERPA', 'ISO', 'CUSTOM']).nullable().optional(),
  maxRetakeAttempts: z.number().int().min(1).nullable().optional(),
  passingScore: z.number().int().min(0).max(100).optional().default(80)
});
export type TComplianceSettings = z.infer<typeof ZComplianceSettings>;

export const ZCourseCreateBase = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: ZCourseType,
  organizationId: z.string().min(1),
  compliance: ZComplianceSettings.optional()
});

export const ZCourseCreate = ZCourseCreateBase.refine(
  (data) => data.type !== 'COMPLIANCE' || data.compliance !== undefined,
  {
    message: 'Compliance settings are required for COMPLIANCE courses',
    path: ['compliance']
  }
);
export type TCourseCreate = z.infer<typeof ZCourseCreate>;

export const ZCourseReward = z.object({
  show: z.boolean(),
  description: z.string().optional()
});

const METADATA_NULLABLE_STRING_KEYS = ['requirements', 'description', 'goals', 'videoUrl', 'paymentLink'] as const;

function preprocessCourseMetadata(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const metadata = { ...(value as Record<string, unknown>) };

  for (const key of METADATA_NULLABLE_STRING_KEYS) {
    if (metadata[key] === null) {
      metadata[key] = undefined;
    }
  }

  if (metadata.instructor && typeof metadata.instructor === 'object' && !Array.isArray(metadata.instructor)) {
    const instructor = { ...(metadata.instructor as Record<string, unknown>) };

    if (instructor.coursesNo === undefined && instructor.courseNo !== undefined) {
      instructor.coursesNo = instructor.courseNo;
    }

    delete instructor.courseNo;
    metadata.instructor = instructor;
  }

  if (metadata.allowNewStudent == null) {
    metadata.allowNewStudent = true;
  }

  if (metadata.discount === null || metadata.discount === '') {
    metadata.discount = undefined;
  } else if (typeof metadata.discount === 'string') {
    const parsedDiscount = toFiniteNumber(metadata.discount);
    if (parsedDiscount !== undefined) {
      metadata.discount = parsedDiscount;
    }
  }

  return metadata;
}

export const ZCourseInstructor = z.object({
  name: z.string(),
  role: z.string(),
  coursesNo: z.coerce.number().optional(),
  description: z.string(),
  imgUrl: z.string()
});

export const ZCourseCertificate = z.object({
  templateUrl: z.string()
});

export const ZCourseReview = z.object({
  id: z.number(),
  hide: z.boolean(),
  name: z.string(),
  avatar_url: z.string(),
  rating: z.number(),
  created_at: z.number(),
  description: z.string()
});

export const ZCourseLessonTabsOrder = z.array(
  z.object({
    id: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    name: z.string()
  })
);

export const ZCourseAudienceAssignmentMode = z.enum(['all', 'members', 'jobTitles', 'departments']);
export type TCourseAudienceAssignmentMode = z.infer<typeof ZCourseAudienceAssignmentMode>;

export const ZCourseAudienceAssignment = z
  .object({
    mode: ZCourseAudienceAssignmentMode,
    memberIds: z.array(z.number().int().positive()).optional(),
    jobTitles: z.array(z.string().min(1).max(120)).optional(),
    departments: z.array(z.string().min(1).max(120)).optional(),
    sendEmail: z.boolean().default(true)
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'members' && (!data.memberIds || data.memberIds.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one employee must be selected',
        path: ['memberIds']
      });
    }
    if (data.mode === 'jobTitles' && (!data.jobTitles || data.jobTitles.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one job title must be selected',
        path: ['jobTitles']
      });
    }
    if (data.mode === 'departments' && (!data.departments || data.departments.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one department must be selected',
        path: ['departments']
      });
    }
  });
export type TCourseAudienceAssignment = z.infer<typeof ZCourseAudienceAssignment>;

const ZCourseMetadataFields = z.object({
  requirements: z.string().optional(),
  description: z.string().optional(),
  goals: z.string().optional(),
  videoUrl: z.string().optional(),
  showDiscount: z.boolean().optional(),
  discount: z.number().optional(),
  paymentLink: z.string().optional(),
  reward: ZCourseReward.optional(),
  instructor: ZCourseInstructor.optional(),
  certificate: ZCourseCertificate.optional(),
  reviews: z.array(ZCourseReview).optional(),
  skills: z.array(z.string().min(1).max(80)).max(60).optional(),
  tools: z.array(z.string().min(1).max(80)).max(60).optional(),
  lessonTabsOrder: ZCourseLessonTabsOrder.optional(),
  grading: z.boolean().optional(),
  lessonDownload: z.boolean().optional(),
  allowNewStudent: z.boolean().default(true),
  welcomeEmailMessage: z.string().max(20000).nullish(),
  sessionTimezone: z.string().max(64).nullish(),
  sectionDisplay: z.record(z.string(), z.boolean()).optional(),
  isContentGroupingEnabled: z.boolean().optional(),
  progressionMode: z.enum(['free', 'sequential']).optional(),
  audienceAssignment: ZCourseAudienceAssignment.optional()
});

// Course metadata schema matching the database structure
export const ZCourseMetadata = z.preprocess(preprocessCourseMetadata, ZCourseMetadataFields);
export type TCourseMetadata = z.infer<typeof ZCourseMetadata>;

export const ZCourseLandingPageMetadataUpdateFields = ZCourseMetadataFields.omit({ allowNewStudent: true }).extend({
  allowNewStudent: z.boolean().optional(),
  reward: ZCourseReward.partial().optional(),
  instructor: ZCourseInstructor.partial().optional(),
  certificate: ZCourseCertificate.partial().optional()
});

export const ZCourseLandingPageMetadataUpdate = z.preprocess(
  preprocessCourseMetadata,
  ZCourseLandingPageMetadataUpdateFields
);
export type TCourseLandingPageMetadataUpdate = z.infer<typeof ZCourseLandingPageMetadataUpdate>;

export const ZCertificationSettings = z.object({
  isDownloadable: z.boolean().optional(),
  /** @deprecated Ignored by renderers; organization settings own the live visual design. */
  theme: z.string().optional(),
  /** @deprecated Ignored by renderers; retained only for legacy payload compatibility. */
  design: ZCertificateDesign.optional(),
  /** ISO 8601 datetime string or null to clear */
  deadline: z.union([z.string().min(1), z.null()]).optional(),
  threshold: z.number().int().min(0).max(100).optional(),
  requiredExerciseId: z.union([z.string().uuid(), z.null()]).optional(),
  exerciseMinScorePercent: z.number().int().min(0).max(100).nullable().optional(),
  emailMessage: z.string().max(5000).nullable().optional()
});
export type TCertificationSettings = z.infer<typeof ZCertificationSettings>;

export const ZCourseUpdateBase = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: ZCourseType.optional(),
  logo: z.string().optional(),
  slug: z.string().optional(),
  isPublished: z.boolean().optional(),
  orgOnly: z.boolean().optional(),
  overview: z.string().optional(),
  metadata: ZCourseMetadata.optional(),
  cost: z.number().int().min(0).optional(),
  currency: z.enum(['NGN', 'USD']).optional(),
  certificate: ZCertificationSettings.optional(),
  tagIds: z.array(z.uuid()).max(100).optional(),
  compliance: ZComplianceSettings.optional(),
  callout: ZCourseCalloutInput.optional()
});

export const ZCourseUpdate = ZCourseUpdateBase.refine(
  (data) => data.type !== 'COMPLIANCE' || data.compliance !== undefined,
  {
    message: 'Compliance settings are required when changing a course to COMPLIANCE',
    path: ['compliance']
  }
);
export type TCourseUpdate = z.infer<typeof ZCourseUpdate>;

export const ZCourseUpdateParam = z.object({
  courseId: z.string().min(1)
});
export type TCourseUpdateParam = z.infer<typeof ZCourseUpdateParam>;

export const ZCourseLandingPageUpdate = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  overview: z.string().optional(),
  cost: z.number().int().min(0).optional(),
  currency: z.enum(['NGN', 'USD']).optional(),
  imageUrl: z.url().optional(),
  generateImage: z.boolean().optional(),
  imageQuery: z.string().min(1).max(120).optional(),
  metadata: ZCourseLandingPageMetadataUpdate.optional()
});
export type TCourseLandingPageUpdate = z.infer<typeof ZCourseLandingPageUpdate>;

export const ZCourseDeleteParam = z.object({
  courseId: z.string().min(1)
});
export type TCourseDeleteParam = z.infer<typeof ZCourseDeleteParam>;

export const ZCourseProgressParam = z.object({
  courseId: z.string().min(1)
});
export type TCourseProgressParam = z.infer<typeof ZCourseProgressParam>;

export const ZCourseProgressQuery = z.object({
  profileId: z.string().uuid()
});
export type TCourseProgressQuery = z.infer<typeof ZCourseProgressQuery>;

export const ZCourseUserAnalyticsParam = z.object({
  courseId: z.string().min(1),
  userId: z.string().uuid()
});
export type TCourseUserAnalyticsParam = z.infer<typeof ZCourseUserAnalyticsParam>;

export const ZCourseUserAnalyticsQuery = z.object({
  includeProgressImpact: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((value) => value === 'true')
});
export type TCourseUserAnalyticsQuery = z.infer<typeof ZCourseUserAnalyticsQuery>;
