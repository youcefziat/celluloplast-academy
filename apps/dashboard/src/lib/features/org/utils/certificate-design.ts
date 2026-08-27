import { DEFAULT_CERTIFICATE_DESIGN, resolveTemplateId, type CertificateDesign } from '@cio/certificates';

/**
 * Resolve the enterprise certificate design from org settings (live inheritance).
 * Falls back to package defaults when the org has not saved a design yet.
 */
export function resolveOrgCertificateDesign(settings: unknown): CertificateDesign {
  const blob =
    settings && typeof settings === 'object' ? (settings as Record<string, unknown>).certificateDesign : undefined;
  const stored = blob && typeof blob === 'object' ? (blob as Partial<CertificateDesign>) : undefined;

  return {
    templateId: resolveTemplateId(stored?.templateId),
    accentColor: stored?.accentColor ?? DEFAULT_CERTIFICATE_DESIGN.accentColor,
    subtitle: stored?.subtitle ?? DEFAULT_CERTIFICATE_DESIGN.subtitle,
    descriptionOverride: stored?.descriptionOverride,
    logoUrl: stored?.logoUrl,
    signatories: [
      {
        name: stored?.signatories?.[0]?.name ?? DEFAULT_CERTIFICATE_DESIGN.signatories[0].name,
        role: stored?.signatories?.[0]?.role ?? DEFAULT_CERTIFICATE_DESIGN.signatories[0].role,
        enabled: stored?.signatories?.[0]?.enabled ?? DEFAULT_CERTIFICATE_DESIGN.signatories[0].enabled,
        signatureUrl: stored?.signatories?.[0]?.signatureUrl
      },
      {
        name: stored?.signatories?.[1]?.name ?? DEFAULT_CERTIFICATE_DESIGN.signatories[1].name,
        role: stored?.signatories?.[1]?.role ?? DEFAULT_CERTIFICATE_DESIGN.signatories[1].role,
        enabled: stored?.signatories?.[1]?.enabled ?? DEFAULT_CERTIFICATE_DESIGN.signatories[1].enabled,
        signatureUrl: stored?.signatories?.[1]?.signatureUrl
      }
    ],
    idFormat: stored?.idFormat ?? DEFAULT_CERTIFICATE_DESIGN.idFormat
  };
}
