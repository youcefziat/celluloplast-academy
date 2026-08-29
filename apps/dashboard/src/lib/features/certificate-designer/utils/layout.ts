import {
  CERTIFICATE_PAGE_HEIGHT,
  CERTIFICATE_PAGE_WIDTH,
  toCertificateLayoutElementSnapshot,
  toCertificateLayoutSnapshot,
  type CertificateImageElement,
  type CertificateLayout,
  type CertificateLayoutElement,
  type CertificateTextElement,
  type CertificateVariable,
  type CertificateVariableElement
} from '@cio/certificates';

export function cloneCertificateLayout(layout: CertificateLayout): CertificateLayout {
  return toCertificateLayoutSnapshot(layout);
}

export function cloneCertificateLayoutElement(element: CertificateLayoutElement): CertificateLayoutElement {
  return toCertificateLayoutElementSnapshot(element);
}

export function createCertificateElementId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function nextZIndex(layout: CertificateLayout): number {
  return Math.max(0, ...layout.elements.map((element) => element.zIndex)) + 1;
}

export function createTextElement(layout: CertificateLayout): CertificateTextElement {
  return {
    id: createCertificateElementId('text'),
    name: 'Texte',
    type: 'text',
    text: 'Votre texte',
    x: 350,
    y: 300,
    width: 400,
    height: 60,
    rotation: 0,
    opacity: 1,
    zIndex: nextZIndex(layout),
    fontFamily: 'inter',
    fontSize: 28,
    fontWeight: 400,
    fontStyle: 'normal',
    textAlign: 'center',
    color: '#111827',
    lineHeight: 1.2
  };
}

export function createVariableElement(
  layout: CertificateLayout,
  variable: CertificateVariable
): CertificateVariableElement {
  return {
    id: createCertificateElementId('variable'),
    name: `{{${variable}}}`,
    type: 'variable',
    variable,
    x: 300,
    y: 330,
    width: 500,
    height: 70,
    rotation: 0,
    opacity: 1,
    zIndex: nextZIndex(layout),
    fontFamily: 'inter',
    fontSize: 34,
    fontWeight: 600,
    fontStyle: 'normal',
    textAlign: 'center',
    color: '#111827',
    lineHeight: 1.2
  };
}

export function createImageElement(
  layout: CertificateLayout,
  role: CertificateImageElement['role'],
  src?: string
): CertificateImageElement {
  const names = { logo: 'Logo', signature: 'Signature', image: 'Image' } as const;
  const width = role === 'signature' ? 220 : 180;
  const height = role === 'signature' ? 90 : 120;

  return {
    id: createCertificateElementId(role),
    name: names[role],
    type: 'image',
    role,
    src,
    x: (CERTIFICATE_PAGE_WIDTH - width) / 2,
    y: (CERTIFICATE_PAGE_HEIGHT - height) / 2,
    width,
    height,
    rotation: 0,
    opacity: 1,
    zIndex: nextZIndex(layout),
    objectFit: 'contain',
    keepRatio: true
  };
}

export function clampCertificateElement(element: CertificateLayoutElement): CertificateLayoutElement {
  const finiteWidth = Number.isFinite(element.width) ? element.width : 24;
  const finiteHeight = Number.isFinite(element.height) ? element.height : 24;
  const finiteX = Number.isFinite(element.x) ? element.x : 0;
  const finiteY = Number.isFinite(element.y) ? element.y : 0;
  const finiteRotation = Number.isFinite(element.rotation) ? element.rotation : 0;
  const finiteOpacity = Number.isFinite(element.opacity) ? element.opacity : 1;
  let width = Math.max(24, Math.min(CERTIFICATE_PAGE_WIDTH, finiteWidth));
  let height = Math.max(24, Math.min(CERTIFICATE_PAGE_HEIGHT, finiteHeight));

  if (element.type === 'image' && element.keepRatio) {
    const positiveWidth = Math.max(1, Math.abs(finiteWidth));
    const positiveHeight = Math.max(1, Math.abs(finiteHeight));
    const minimumScale = Math.max(1, 24 / positiveWidth, 24 / positiveHeight);
    const minimumWidth = positiveWidth * minimumScale;
    const minimumHeight = positiveHeight * minimumScale;
    const maximumScale = Math.min(1, CERTIFICATE_PAGE_WIDTH / minimumWidth, CERTIFICATE_PAGE_HEIGHT / minimumHeight);
    width = minimumWidth * maximumScale;
    height = minimumHeight * maximumScale;
  }
  const clampedElement = {
    ...element,
    width,
    height,
    x: Math.max(0, Math.min(CERTIFICATE_PAGE_WIDTH - width, finiteX)),
    y: Math.max(0, Math.min(CERTIFICATE_PAGE_HEIGHT - height, finiteY)),
    rotation: Math.max(-360, Math.min(360, finiteRotation)),
    opacity: Math.max(0, Math.min(1, finiteOpacity))
  };

  if (clampedElement.type === 'image') return clampedElement;

  const finiteFontSize = Number.isFinite(clampedElement.fontSize) ? clampedElement.fontSize : 16;

  return {
    ...clampedElement,
    fontSize: Math.max(6, Math.min(240, finiteFontSize))
  };
}

export function normalizeCertificateLayerOrder(elements: CertificateLayoutElement[]): CertificateLayoutElement[] {
  const orderedElements = [...elements].sort((leftElement, rightElement) => leftElement.zIndex - rightElement.zIndex);

  return assignCertificateLayerOrder(orderedElements);
}

export function assignCertificateLayerOrder(elements: CertificateLayoutElement[]): CertificateLayoutElement[] {
  return elements.map((element, index) => ({ ...element, zIndex: index + 1 }));
}
