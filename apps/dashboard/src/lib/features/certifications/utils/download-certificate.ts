import { classroomio } from '$lib/utils/services/api';
import { normalizeCertificateIssuedAt } from '$features/course/utils/certificate-utils';

export type CertificateDownloadTarget = {
  courseId: string;
  courseTitle: string;
  profileId: string;
  fullname: string | null;
  certificateEarnedAt: string;
};

/**
 * Downloads the on-demand PDF certificate for a learner using the upstream
 * `POST /course/:courseId/download/certificate` endpoint.
 *
 * For another learner, the API requires the caller to be course team / org admin
 * and checks eligibility against that learner's `certificate_earned_at`.
 */
export async function downloadLearnerCertificatePdf(target: CertificateDownloadTarget): Promise<void> {
  const response = await classroomio.course[':courseId']['download']['certificate']['$post']({
    param: { courseId: target.courseId },
    json: {
      studentName: target.fullname?.trim() || 'Recipient',
      studentId: target.profileId,
      issuedAt: normalizeCertificateIssuedAt(target.certificateEarnedAt)
    }
  });

  if (!response.ok) {
    throw new Error(`Certificate download failed with status ${response.status}`);
  }

  const blobResponse = await response.blob();
  const url = URL.createObjectURL(new Blob([blobResponse], { type: 'application/pdf' }));
  const link = document.createElement('a');
  const safeTitle = (target.courseTitle || 'certificate').replace(/\s+/g, '-').toLowerCase();

  document.body.append(link);
  link.download = `certificate-${safeTitle}.pdf`;
  link.href = url;
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
