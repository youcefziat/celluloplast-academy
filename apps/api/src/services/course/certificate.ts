import { AppError, ErrorCodes } from '@api/utils/errors';
import { getCourseById, getCourseOrganizationId, getOrganizationById, getProfileById } from '@cio/db/queries';
import type { CertificateRenderInput } from '@api/utils/certificate';
import type { TCertificateDownloadRequest } from '@cio/utils/validation/course';
import { resolveOrganizationCertificateLayout, splitCertificateRecipientName } from '@cio/certificates';

/**
 * Loads the design + render data for a given course/student pair so the API
 * can hand it to `generateCertificatePdf` / `generateCertificatePng`.
 *
 * The client only sends `studentName` (+ optional studentId/issuedAt). Everything
 * else comes from the database: title, description, org name + logo, design.
 */
export async function assembleCertificateRender(
  courseId: string,
  body: TCertificateDownloadRequest
): Promise<CertificateRenderInput> {
  const [courseRow] = await getCourseById(courseId);
  if (!courseRow) {
    throw new AppError('Course not found', ErrorCodes.COURSE_NOT_FOUND, 404);
  }

  const organizationId = await getCourseOrganizationId(courseId);
  const organization = organizationId ? await getOrganizationById(organizationId) : null;

  const design = resolveOrganizationCertificateLayout(organization?.settings);

  const studentProfile = body.studentId ? await getProfileById(body.studentId) : null;
  const recipientName = studentProfile?.fullname?.trim() || body.studentName;
  const derivedRecipientName = splitCertificateRecipientName(recipientName);
  const recipientEmail = studentProfile?.email ?? '';

  const issuedAtIso = body.issuedAt ?? new Date().toISOString();
  const issuedAtDate = new Date(issuedAtIso);
  const date = Number.isNaN(issuedAtDate.getTime())
    ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' })
    : issuedAtDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });

  const certificateSequence = body.studentId ?? fallbackSequence(issuedAtDate);
  const certificateId = formatCertificateId(design.certificateIdFormat, certificateSequence, issuedAtDate);
  const orgLogoUrl = organization?.avatarUrl ?? undefined;

  return {
    design,
    data: {
      recipientName,
      recipientFirstName: derivedRecipientName.firstName,
      recipientLastName: derivedRecipientName.lastName,
      recipientEmail,
      courseName: courseRow.title,
      courseDescription: courseRow.description ?? '',
      orgName: organization?.name ?? '',
      orgLogoUrl,
      date,
      certificateId
    }
  };
}

function formatCertificateId(format: string | undefined, seq: string, issuedAt: Date): string {
  const year = issuedAt.getFullYear();
  const month = String(issuedAt.getMonth() + 1).padStart(2, '0');
  const tail = seq.replace(/-/g, '').slice(-4).toUpperCase() || '0001';

  return (format ?? 'N° {seq}').replace('{seq}', tail).replace('{year}', String(year)).replace('{month}', month);
}

function fallbackSequence(issuedAt: Date): string {
  return String(issuedAt.getTime()).slice(-6);
}

export async function assembleOwnerPreviewRender(
  courseId: string,
  userId: string,
  body: TCertificateDownloadRequest
): Promise<CertificateRenderInput> {
  let studentName = body.studentName;
  if (!studentName.trim().length) {
    const profile = await getProfileById(userId);
    studentName = profile?.fullname || 'Preview Recipient';
  }

  return assembleCertificateRender(courseId, { ...body, studentName });
}
