/**
 * Grants certificates that were earned while certificate issuing was switched off.
 *
 * `certificateEarnedAt` is written only when eligibility is evaluated — on finishing a lesson,
 * submitting an exercise, or opening a course's certificate page. When the api container was
 * missing PUBLIC_IS_SELFHOSTED it treated the install as a paid cloud plan, decided
 * certificates were disabled, and persisted nothing. Learners who finished during that window
 * stay without a certificate until they happen to reopen the course.
 *
 * Eligibility is never re-implemented here: the dry run calls the same
 * `buildCertificationEvaluation` the app uses, and applying calls
 * `evaluateCourseCertification`, which is idempotent and grants only what is genuinely earned.
 *
 * Applying sends each learner the course-completion email, exactly as finishing normally
 * would. That is why the dry run is the default.
 *
 *   docker exec -w /app/apps/api celluloplast-api node dist/scripts/backfill-certificates.js
 *   docker exec -w /app/apps/api celluloplast-api node dist/scripts/backfill-certificates.js --apply
 */
import { getCertificateBackfillCandidates, getCourseCertificationRow } from '@cio/db/queries/course';
import { buildCertificationEvaluation, evaluateCourseCertification } from '@api/services/course/completion';

type CandidateOutcome = {
  courseTitle: string;
  email: string;
  eligible: boolean;
};

/** Course rows are shared by every learner on that course; fetch each one once. */
const certificationRowCache = new Map<string, Awaited<ReturnType<typeof getCourseCertificationRow>>>();

async function readCertificationRow(courseId: string) {
  if (!certificationRowCache.has(courseId)) {
    certificationRowCache.set(courseId, await getCourseCertificationRow(courseId));
  }

  return certificationRowCache.get(courseId) ?? null;
}

async function main() {
  const shouldApply = process.argv.includes('--apply');
  const candidates = await getCertificateBackfillCandidates();

  console.log(`${candidates.length} enrolment(s) in a published course without a certificate date.`);

  if (candidates.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const outcomes: CandidateOutcome[] = [];
  let granted = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const email = candidate.email ?? candidate.profileId;

    try {
      const courseRow = await readCertificationRow(candidate.courseId);

      if (!courseRow) continue;

      const evaluation = await buildCertificationEvaluation(candidate.courseId, candidate.profileId, courseRow);

      if (!evaluation.eligibleForCertificate) continue;

      outcomes.push({ courseTitle: candidate.courseTitle, email, eligible: true });

      if (shouldApply) {
        const result = await evaluateCourseCertification(candidate.courseId, candidate.profileId);

        if (result.certificateEarnedAt) granted++;
      }
    } catch (error) {
      failed++;
      console.error(
        `  failed for ${email} on "${candidate.courseTitle}":`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(`\n${outcomes.length} learner(s) have genuinely earned a certificate:`);
  for (const outcome of outcomes) {
    console.log(`  ${outcome.email} — ${outcome.courseTitle}`);
  }

  if (!shouldApply) {
    console.log('\nDry run: nothing was written. Re-run with --apply to grant these.');
    console.log('Applying also emails each learner their course-completion notice.');
  } else {
    console.log(`\nGranted ${granted} certificate(s).`);
  }

  if (failed > 0) {
    console.log(`${failed} enrolment(s) could not be evaluated; see the errors above.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('backfill-certificates failed:', error);
    process.exit(1);
  });
