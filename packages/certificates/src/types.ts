export const CERTIFICATE_TEMPLATE_IDS = ['classique', 'brutalist', 'noir', 'poster', 'minimal'] as const;
export type CertificateTemplateId = (typeof CERTIFICATE_TEMPLATE_IDS)[number];

export interface CertificateSignatory {
  name: string;
  role: string;
  enabled: boolean;
  signatureUrl?: string;
}

export interface CertificateDesign {
  templateId: CertificateTemplateId;
  accentColor: string;
  subtitle?: string;
  descriptionOverride?: string;
  /** Optional certificate logo; render falls back to organization avatar when absent. */
  logoUrl?: string;
  signatories: [CertificateSignatory, CertificateSignatory];
  idFormat?: string;
}

export const CERTIFICATE_LAYOUT_VERSION = 1 as const;
export const CERTIFICATE_PAGE_WIDTH = 1100;
export const CERTIFICATE_PAGE_HEIGHT = 780;

export const CERTIFICATE_FONT_FAMILIES = [
  'inter',
  'cormorant-garamond',
  'cinzel',
  'playfair-display',
  'space-grotesk',
  'dm-mono'
] as const;
export type CertificateFontFamily = (typeof CERTIFICATE_FONT_FAMILIES)[number];

export const CERTIFICATE_VARIABLES = [
  'student.fullName',
  'student.firstName',
  'student.lastName',
  'student.email',
  'course.name',
  'course.description',
  'certificate.date',
  'certificate.id',
  'organization.name'
] as const;
export type CertificateVariable = (typeof CERTIFICATE_VARIABLES)[number];

export interface CertificateLayoutPage {
  width: typeof CERTIFICATE_PAGE_WIDTH;
  height: typeof CERTIFICATE_PAGE_HEIGHT;
  backgroundColor: string;
  backgroundImageUrl?: string;
  backgroundImageOpacity?: number;
}

export interface CertificateLayoutElementBase {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  locked?: boolean;
}

export interface CertificateTextStyle {
  fontFamily: CertificateFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  lineHeight: number;
}

export interface CertificateTextElement extends CertificateLayoutElementBase, CertificateTextStyle {
  type: 'text';
  text: string;
}

export interface CertificateVariableElement extends CertificateLayoutElementBase, CertificateTextStyle {
  type: 'variable';
  variable: CertificateVariable;
}

export interface CertificateImageElement extends CertificateLayoutElementBase {
  type: 'image';
  role: 'logo' | 'signature' | 'image';
  src?: string;
  objectFit: 'contain' | 'cover';
  keepRatio: boolean;
}

export type CertificateLayoutElement = CertificateTextElement | CertificateVariableElement | CertificateImageElement;

/** Canonical, persisted enterprise certificate document. */
export interface CertificateLayout {
  version: typeof CERTIFICATE_LAYOUT_VERSION;
  page: CertificateLayoutPage;
  elements: CertificateLayoutElement[];
  certificateIdFormat?: string;
  sourcePresetId?: CertificateTemplateId;
}

export type CertificateRenderableDesign = CertificateDesign | CertificateLayout;

export interface CertificateVariableContext {
  student: {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  course: {
    name: string;
    description: string;
  };
  certificate: {
    date: string;
    id: string;
  };
  organization: {
    name: string;
    logoUrl?: string;
  };
}

export interface CertificateRenderData {
  recipientName: string;
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientEmail?: string;
  courseName: string;
  courseDescription: string;
  orgName: string;
  orgLogoUrl?: string;
  date: string;
  certificateId: string;
}

export interface CertificateRenderResult {
  html: string;
  styles: string;
}

export interface CertificateTemplateMeta {
  id: CertificateTemplateId;
  label: string;
  description: string;
}
