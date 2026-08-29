import { renderCertificate, type CertificateLayout, type CertificateRenderData } from '@cio/certificates';

import { getCloudflarePdfBuffer, getCloudflarePngBuffer } from '@api/utils/cloudflare';

export interface CertificateRenderInput {
  design: CertificateLayout;
  data: CertificateRenderData;
}

export async function generateCertificatePdf(input: CertificateRenderInput) {
  const { html, styles } = renderCertificate(input.design, input.data);

  return getCloudflarePdfBuffer(html, styles);
}

export async function generateCertificatePng(input: CertificateRenderInput) {
  const { html, styles } = renderCertificate(input.design, input.data);

  return getCloudflarePngBuffer(html, styles);
}
