import { resolveOrganizationCertificateLayout, type CertificateLayout } from '@cio/certificates';

/**
 * Resolve the enterprise certificate design from org settings (live inheritance).
 * Falls back to package defaults when the org has not saved a design yet.
 */
export function resolveOrgCertificateDesign(settings: unknown): CertificateLayout {
  return resolveOrganizationCertificateLayout(settings);
}
