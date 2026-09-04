import { renderCertificate, type CertificateLayout, type CertificateRenderData } from '@cio/certificates';

import { getPdfBuffer, getPngBuffer } from '@api/utils/browser-render';

export interface CertificateRenderInput {
  design: CertificateLayout;
  data: CertificateRenderData;
}

export async function generateCertificatePdf(input: CertificateRenderInput) {
  const { html, styles } = renderCertificate(input.design, input.data);

  return getPdfBuffer(html, styles);
}

export async function generateCertificatePng(input: CertificateRenderInput) {
  const { html, styles } = renderCertificate(input.design, input.data);

  return getPngBuffer(html, styles);
}
