export {
  CERTIFICATE_FONT_FAMILIES,
  CERTIFICATE_LAYOUT_VERSION,
  CERTIFICATE_PAGE_HEIGHT,
  CERTIFICATE_PAGE_WIDTH,
  CERTIFICATE_TEMPLATE_IDS,
  CERTIFICATE_VARIABLES,
  type CertificateDesign,
  type CertificateFontFamily,
  type CertificateImageElement,
  type CertificateLayout,
  type CertificateLayoutElement,
  type CertificateLayoutElementBase,
  type CertificateLayoutPage,
  type CertificateRenderData,
  type CertificateRenderableDesign,
  type CertificateRenderResult,
  type CertificateSignatory,
  type CertificateTemplateId,
  type CertificateTemplateMeta,
  type CertificateTextElement,
  type CertificateTextStyle,
  type CertificateVariable,
  type CertificateVariableContext,
  type CertificateVariableElement
} from './types';

export {
  ACCENT_COLORS,
  CERTIFICATE_TEMPLATES,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_CERTIFICATE_DESIGN,
  LEGACY_THEME_MAP,
  type AccentColor
} from './constants';

export { CERTIFICATE_DEFAULT_ACCENT, CERTIFICATE_DEFAULT_ORG_LABEL } from './celluloplast-brand';

export {
  createCertificateLayoutPreset,
  DEFAULT_CERTIFICATE_LAYOUT,
  isCertificateLayout,
  isCertificateVariable,
  migrateLegacyCertificateDesign,
  resolveOrganizationCertificateLayout,
  toCertificateLayoutElementSnapshot,
  toCertificateLayoutSnapshot
} from './layout';

export {
  CERTIFICATE_PREVIEW_CONTEXT,
  resolveCertificateVariable,
  splitCertificateRecipientName,
  toCertificateVariableContext
} from './variables';

export { renderCertificate, renderCertificateDocument, resolveTemplateId } from './render';
export { FONTS_LINK_HREF as CERTIFICATE_FONTS_STYLESHEET_URL } from './templates/shared';
