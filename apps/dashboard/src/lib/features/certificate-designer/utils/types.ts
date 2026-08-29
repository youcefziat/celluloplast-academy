import type {
  CertificateImageElement,
  CertificateLayout,
  CertificateLayoutElementBase,
  CertificateTextElement,
  CertificateTextStyle,
  CertificateVariableElement
} from '@cio/certificates';

export type CertificateDesignerPanel = 'add' | 'templates' | 'layers' | 'properties';
export type CertificateDesignerMode = 'edit' | 'preview';
export type CertificateResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type CertificateLayoutSnapshot = CertificateLayout;

/** Patch shape shared by the three discriminated element variants. */
export type CertificateLayoutElementPatch = Partial<CertificateLayoutElementBase> &
  Partial<CertificateTextStyle> &
  Partial<Pick<CertificateTextElement, 'text'>> &
  Partial<Pick<CertificateVariableElement, 'variable'>> &
  Partial<Pick<CertificateImageElement, 'role' | 'src' | 'objectFit' | 'keepRatio'>>;
