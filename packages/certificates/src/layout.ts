import { DEFAULT_CERTIFICATE_DESIGN, LEGACY_THEME_MAP } from './constants';
import type {
  CertificateDesign,
  CertificateFontFamily,
  CertificateImageElement,
  CertificateLayout,
  CertificateLayoutElement,
  CertificateLayoutElementBase,
  CertificateLayoutPage,
  CertificateTemplateId,
  CertificateTextElement,
  CertificateTextStyle,
  CertificateVariable,
  CertificateVariableElement
} from './types';
import {
  CERTIFICATE_LAYOUT_VERSION,
  CERTIFICATE_PAGE_HEIGHT,
  CERTIFICATE_PAGE_WIDTH,
  CERTIFICATE_TEMPLATE_IDS,
  CERTIFICATE_VARIABLES
} from './types';

const TEXT_DEFAULTS: CertificateTextStyle = {
  fontFamily: 'space-grotesk',
  fontSize: 24,
  fontWeight: 400,
  fontStyle: 'normal',
  textAlign: 'center',
  color: '#1f2937',
  lineHeight: 1.2
};

function snapshotString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new TypeError(`Certificate layout field "${field}" must be a string`);

  return value;
}

function snapshotNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`Certificate layout field "${field}" must be a finite number`);
  }

  return value;
}

function snapshotBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`Certificate layout field "${field}" must be a boolean`);

  return value;
}

function toCertificateElementBaseSnapshot(element: CertificateLayoutElement): CertificateLayoutElementBase {
  const base: CertificateLayoutElementBase = {
    id: snapshotString(element.id, 'element.id'),
    name: snapshotString(element.name, 'element.name'),
    x: snapshotNumber(element.x, 'element.x'),
    y: snapshotNumber(element.y, 'element.y'),
    width: snapshotNumber(element.width, 'element.width'),
    height: snapshotNumber(element.height, 'element.height'),
    rotation: snapshotNumber(element.rotation, 'element.rotation'),
    opacity: snapshotNumber(element.opacity, 'element.opacity'),
    zIndex: snapshotNumber(element.zIndex, 'element.zIndex')
  };

  if (element.locked !== undefined) base.locked = snapshotBoolean(element.locked, 'element.locked');

  return base;
}

function toCertificateTextStyleSnapshot(
  element: CertificateTextElement | CertificateVariableElement
): CertificateTextStyle {
  return {
    fontFamily: snapshotString(element.fontFamily, 'element.fontFamily') as CertificateFontFamily,
    fontSize: snapshotNumber(element.fontSize, 'element.fontSize'),
    fontWeight: snapshotNumber(element.fontWeight, 'element.fontWeight') as CertificateTextStyle['fontWeight'],
    fontStyle: snapshotString(element.fontStyle, 'element.fontStyle') as CertificateTextStyle['fontStyle'],
    textAlign: snapshotString(element.textAlign, 'element.textAlign') as CertificateTextStyle['textAlign'],
    color: snapshotString(element.color, 'element.color'),
    lineHeight: snapshotNumber(element.lineHeight, 'element.lineHeight')
  };
}

/**
 * Copies one certificate element through an explicit persistence boundary.
 * Only scalar fields declared by the certificate model are retained, so Svelte
 * proxies and accidental browser/runtime objects cannot leak into snapshots.
 */
export function toCertificateLayoutElementSnapshot(element: CertificateLayoutElement): CertificateLayoutElement {
  const base = toCertificateElementBaseSnapshot(element);

  if (element.type === 'text') {
    return {
      ...base,
      ...toCertificateTextStyleSnapshot(element),
      type: 'text',
      text: snapshotString(element.text, 'element.text')
    };
  }

  if (element.type === 'variable') {
    return {
      ...base,
      ...toCertificateTextStyleSnapshot(element),
      type: 'variable',
      variable: snapshotString(element.variable, 'element.variable') as CertificateVariable
    };
  }

  if (element.type !== 'image') throw new TypeError('Certificate layout element type is invalid');

  const image: CertificateImageElement = {
    ...base,
    type: 'image',
    role: snapshotString(element.role, 'element.role') as CertificateImageElement['role'],
    objectFit: snapshotString(element.objectFit, 'element.objectFit') as CertificateImageElement['objectFit'],
    keepRatio: snapshotBoolean(element.keepRatio, 'element.keepRatio')
  };

  if (element.src !== undefined) image.src = snapshotString(element.src, 'element.src');

  return image;
}

/**
 * Produces the canonical plain-data document used by history and persistence.
 * The returned graph contains arrays, plain objects and JSON-safe primitives only.
 */
export function toCertificateLayoutSnapshot(layout: CertificateLayout): CertificateLayout {
  const page: CertificateLayoutPage = {
    width: snapshotNumber(layout.page.width, 'page.width') as CertificateLayoutPage['width'],
    height: snapshotNumber(layout.page.height, 'page.height') as CertificateLayoutPage['height'],
    backgroundColor: snapshotString(layout.page.backgroundColor, 'page.backgroundColor')
  };

  if (layout.page.backgroundImageUrl !== undefined) {
    page.backgroundImageUrl = snapshotString(layout.page.backgroundImageUrl, 'page.backgroundImageUrl');
  }
  if (layout.page.backgroundImageOpacity !== undefined) {
    page.backgroundImageOpacity = snapshotNumber(layout.page.backgroundImageOpacity, 'page.backgroundImageOpacity');
  }

  const snapshot: CertificateLayout = {
    version: CERTIFICATE_LAYOUT_VERSION,
    page,
    elements: Array.from(layout.elements, toCertificateLayoutElementSnapshot)
  };

  if (layout.certificateIdFormat !== undefined) {
    snapshot.certificateIdFormat = snapshotString(layout.certificateIdFormat, 'certificateIdFormat');
  }
  if (layout.sourcePresetId !== undefined) {
    snapshot.sourcePresetId = snapshotString(layout.sourcePresetId, 'sourcePresetId') as CertificateTemplateId;
  }

  return snapshot;
}

function resolvePresetId(value: string | undefined): CertificateTemplateId {
  if (value && CERTIFICATE_TEMPLATE_IDS.includes(value as CertificateTemplateId)) {
    return value as CertificateTemplateId;
  }

  return (value && LEGACY_THEME_MAP[value]) || 'classique';
}

type TextOverrides = Partial<CertificateTextElement> & Pick<CertificateTextElement, 'id' | 'name' | 'text'>;
type VariableOverrides = Partial<CertificateVariableElement> &
  Pick<CertificateVariableElement, 'id' | 'name' | 'variable'>;

function createText(overrides: TextOverrides): CertificateTextElement {
  return {
    type: 'text',
    x: 150,
    y: 100,
    width: 800,
    height: 60,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    ...TEXT_DEFAULTS,
    ...overrides
  };
}

function createVariable(overrides: VariableOverrides): CertificateVariableElement {
  return {
    type: 'variable',
    x: 200,
    y: 260,
    width: 700,
    height: 70,
    rotation: 0,
    opacity: 1,
    zIndex: 2,
    ...TEXT_DEFAULTS,
    fontSize: 42,
    fontWeight: 600,
    ...overrides
  };
}

function createBaseElements(accentColor: string, fontFamily: CertificateFontFamily): CertificateLayoutElement[] {
  return [
    {
      id: 'organization-logo',
      name: "Logo de l'organisation",
      type: 'image',
      role: 'logo',
      x: 450,
      y: 35,
      width: 200,
      height: 70,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      objectFit: 'contain',
      keepRatio: true
    },
    createText({
      id: 'title',
      name: 'Titre',
      text: 'CERTIFICAT DE RÉUSSITE',
      y: 120,
      height: 70,
      fontFamily,
      fontSize: 42,
      fontWeight: 700,
      color: accentColor
    }),
    createText({
      id: 'awarded-label',
      name: 'Libellé bénéficiaire',
      text: 'Ce certificat est décerné à',
      y: 220,
      height: 38,
      fontFamily,
      fontSize: 20,
      color: '#4b5563'
    }),
    createVariable({
      id: 'student-name',
      name: 'Nom complet',
      variable: 'student.fullName',
      y: 270,
      fontFamily,
      fontSize: 48,
      fontWeight: 600,
      color: '#111827'
    }),
    createText({
      id: 'course-label',
      name: 'Libellé formation',
      text: 'Pour avoir terminé avec succès',
      y: 370,
      height: 36,
      fontFamily,
      fontSize: 18,
      color: '#4b5563'
    }),
    createVariable({
      id: 'course-name',
      name: 'Nom de la formation',
      variable: 'course.name',
      x: 180,
      y: 415,
      width: 740,
      height: 64,
      fontFamily,
      fontSize: 30,
      fontWeight: 600,
      color: accentColor
    }),
    createVariable({
      id: 'certificate-date',
      name: "Date d'obtention",
      variable: 'certificate.date',
      x: 130,
      y: 650,
      width: 260,
      height: 34,
      fontFamily,
      fontSize: 16,
      fontWeight: 400,
      textAlign: 'left',
      color: '#374151'
    }),
    createVariable({
      id: 'organization-name',
      name: "Nom de l'organisation",
      variable: 'organization.name',
      x: 710,
      y: 650,
      width: 260,
      height: 34,
      fontFamily,
      fontSize: 16,
      fontWeight: 600,
      textAlign: 'right',
      color: '#374151'
    })
  ];
}

const PRESET_STYLES: Record<
  CertificateTemplateId,
  { backgroundColor: string; accentColor: string; fontFamily: CertificateFontFamily }
> = {
  classique: { backgroundColor: '#faf6ec', accentColor: '#7c4a1d', fontFamily: 'cormorant-garamond' },
  brutalist: { backgroundColor: '#f0ede4', accentColor: '#ff4500', fontFamily: 'space-grotesk' },
  noir: { backgroundColor: '#0e0e0e', accentColor: '#d4af37', fontFamily: 'playfair-display' },
  poster: { backgroundColor: '#fef2dc', accentColor: '#ff5722', fontFamily: 'space-grotesk' },
  minimal: { backgroundColor: '#ffffff', accentColor: '#111111', fontFamily: 'inter' }
};

function normalizeLayerOrder(elements: CertificateLayoutElement[]): CertificateLayoutElement[] {
  return [...elements]
    .sort((leftElement, rightElement) => leftElement.zIndex - rightElement.zIndex)
    .map((element, index) => ({ ...element, zIndex: index + 1 }));
}

export function createCertificateLayoutPreset(templateId: CertificateTemplateId): CertificateLayout {
  const preset = PRESET_STYLES[templateId];
  const elements = createBaseElements(preset.accentColor, preset.fontFamily);

  if (templateId === 'noir') {
    for (const element of elements) {
      if (element.type !== 'image' && element.color === '#111827') element.color = '#f5f1e8';
      if (element.type !== 'image' && element.color === '#4b5563') element.color = '#b7aa91';
      if (element.type !== 'image' && element.color === '#374151') element.color = '#d8cdb9';
    }
  }

  if (templateId === 'brutalist') {
    const studentName = elements.find((element) => element.id === 'student-name');
    if (studentName?.type === 'variable') {
      studentName.textAlign = 'left';
      studentName.x = 90;
      studentName.width = 920;
      studentName.fontSize = 56;
    }
  }

  if (templateId === 'poster') {
    const title = elements.find((element) => element.id === 'title');
    if (title?.type === 'text') {
      title.rotation = -2;
      title.fontSize = 48;
    }
  }

  return {
    version: CERTIFICATE_LAYOUT_VERSION,
    page: {
      width: CERTIFICATE_PAGE_WIDTH,
      height: CERTIFICATE_PAGE_HEIGHT,
      backgroundColor: preset.backgroundColor,
      backgroundImageOpacity: 1
    },
    elements: normalizeLayerOrder(elements),
    certificateIdFormat: 'CERT-{year}-{seq}',
    sourcePresetId: templateId
  };
}

export const DEFAULT_CERTIFICATE_LAYOUT = createCertificateLayoutPreset('classique');

export function isCertificateLayout(value: unknown): value is CertificateLayout {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<CertificateLayout>;
  return candidate.version === CERTIFICATE_LAYOUT_VERSION && !!candidate.page && Array.isArray(candidate.elements);
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function legacySignatoryElements(design: CertificateDesign): CertificateLayoutElement[] {
  const elements: CertificateLayoutElement[] = [];
  const positions = [600, 820] as const;

  design.signatories.forEach((signatory, index) => {
    if (!signatory.enabled) return;

    if (isHttpUrl(signatory.signatureUrl)) {
      elements.push({
        id: `signature-${index + 1}`,
        name: `Signature ${index + 1}`,
        type: 'image',
        role: 'signature',
        src: signatory.signatureUrl,
        x: positions[index],
        y: 555,
        width: 170,
        height: 65,
        rotation: 0,
        opacity: 1,
        zIndex: 5 + index,
        objectFit: 'contain',
        keepRatio: true
      });
    }

    elements.push(
      createText({
        id: `signatory-${index + 1}`,
        name: `Signataire ${index + 1}`,
        text: [signatory.name, signatory.role].filter(Boolean).join('\n'),
        x: positions[index] - 35,
        y: 620,
        width: 240,
        height: 58,
        fontSize: 15,
        fontWeight: 500,
        zIndex: 7 + index
      })
    );
  });

  return elements;
}

/** Converts the pre-layout editor document into editable V1 elements. */
export function migrateLegacyCertificateDesign(stored: unknown): CertificateLayout {
  if (isCertificateLayout(stored)) return toCertificateLayoutSnapshot(stored);

  const blob = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const nestedDesign = blob.design && typeof blob.design === 'object' ? blob.design : undefined;
  const rawDesign = (nestedDesign ?? blob) as Partial<CertificateDesign>;
  const templateId = resolvePresetId(rawDesign.templateId ?? (typeof blob.theme === 'string' ? blob.theme : undefined));
  const fallback = DEFAULT_CERTIFICATE_DESIGN;
  const design: CertificateDesign = {
    templateId,
    accentColor: /^#[0-9a-fA-F]{6}$/.test(rawDesign.accentColor ?? '')
      ? rawDesign.accentColor!
      : PRESET_STYLES[templateId].accentColor,
    subtitle: rawDesign.subtitle ?? fallback.subtitle,
    descriptionOverride: rawDesign.descriptionOverride,
    logoUrl: isHttpUrl(rawDesign.logoUrl) ? rawDesign.logoUrl : undefined,
    signatories: [
      {
        ...fallback.signatories[0],
        ...(rawDesign.signatories?.[0] ?? {})
      },
      {
        ...fallback.signatories[1],
        ...(rawDesign.signatories?.[1] ?? {})
      }
    ],
    idFormat: rawDesign.idFormat ?? fallback.idFormat
  };
  const layout = createCertificateLayoutPreset(templateId);

  for (const element of layout.elements) {
    if (element.type !== 'image' && (element.id === 'title' || element.id === 'course-name')) {
      element.color = design.accentColor;
    }
  }

  if (design.subtitle) {
    layout.elements.push(
      createText({
        id: 'legacy-subtitle',
        name: 'Sous-titre',
        text: design.subtitle,
        y: 185,
        height: 32,
        fontSize: 16,
        color: design.accentColor,
        zIndex: 10
      })
    );
  }

  if (design.descriptionOverride) {
    layout.elements.push(
      createText({
        id: 'legacy-description',
        name: 'Description',
        text: design.descriptionOverride,
        x: 200,
        y: 495,
        width: 700,
        height: 55,
        fontSize: 15,
        color: templateId === 'noir' ? '#d8cdb9' : '#4b5563',
        zIndex: 11
      })
    );
  }

  if (design.logoUrl) {
    const logo = layout.elements.find(
      (element): element is CertificateImageElement => element.type === 'image' && element.role === 'logo'
    );
    if (logo) logo.src = design.logoUrl;
  }

  layout.elements.push(...legacySignatoryElements(design));
  layout.elements = normalizeLayerOrder(layout.elements);
  layout.certificateIdFormat = design.idFormat;

  return layout;
}

/**
 * Resolves the single live certificate layout owned by an organization.
 *
 * Course certificate fields are intentionally ignored: a course controls
 * eligibility and delivery only, never the visual certificate design.
 */
export function resolveOrganizationCertificateLayout(settings: unknown): CertificateLayout {
  const organizationSettings =
    settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : undefined;

  return migrateLegacyCertificateDesign(organizationSettings?.certificateDesign);
}

export function isCertificateVariable(value: string): value is CertificateVariable {
  return CERTIFICATE_VARIABLES.includes(value as CertificateVariable);
}
