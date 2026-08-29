import type {
  CertificateImageElement,
  CertificateLayout,
  CertificateLayoutElement,
  CertificateRenderData,
  CertificateTextElement,
  CertificateVariableElement,
  CertificateVariableContext
} from './types';
import { escapeHtml } from './templates/shared';
import { resolveCertificateVariable, toCertificateVariableContext } from './variables';

const FONT_STACKS = {
  inter: 'Inter, Arial, sans-serif',
  'cormorant-garamond': "'Cormorant Garamond', Georgia, serif",
  cinzel: 'Cinzel, Georgia, serif',
  'playfair-display': "'Playfair Display', Georgia, serif",
  'space-grotesk': "'Space Grotesk', Arial, sans-serif",
  'dm-mono': "'DM Mono', monospace"
} as const;

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function commonStyle(element: CertificateLayoutElement): string {
  return [
    'position:absolute',
    `left:${finite(element.x)}px`,
    `top:${finite(element.y)}px`,
    `width:${Math.max(1, finite(element.width, 1))}px`,
    `height:${Math.max(1, finite(element.height, 1))}px`,
    `opacity:${Math.max(0, Math.min(1, finite(element.opacity, 1)))}`,
    `z-index:${Math.round(finite(element.zIndex))}`,
    `transform:rotate(${finite(element.rotation)}deg)`,
    'transform-origin:center center'
  ].join(';');
}

function textStyle(element: CertificateTextElement | CertificateVariableElement): string {
  return [
    commonStyle(element),
    'display:flex',
    'align-items:center',
    `justify-content:${
      element.textAlign === 'left' ? 'flex-start' : element.textAlign === 'right' ? 'flex-end' : 'center'
    }`,
    `font-family:${FONT_STACKS[element.fontFamily]}`,
    `font-size:${Math.max(6, finite(element.fontSize, 16))}px`,
    `font-weight:${element.fontWeight}`,
    `font-style:${element.fontStyle}`,
    `line-height:${Math.max(0.7, finite(element.lineHeight, 1.2))}`,
    `text-align:${element.textAlign}`,
    `color:${element.color}`,
    'white-space:pre-wrap',
    'overflow:hidden',
    'overflow-wrap:anywhere'
  ].join(';');
}

function renderTextElement(
  element: CertificateTextElement | CertificateVariableElement,
  context: CertificateVariableContext
): string {
  const value = element.type === 'variable' ? resolveCertificateVariable(element.variable, context) : element.text;

  return `<div class="certificate-layout-element certificate-layout-text" data-element-id="${escapeHtml(
    element.id
  )}" style="${textStyle(element)}">${escapeHtml(value)}</div>`;
}

function imageSource(element: CertificateImageElement, context: CertificateVariableContext): string | undefined {
  if (element.src) return element.src;
  if (element.role === 'logo') return context.organization.logoUrl;

  return undefined;
}

function renderImageElement(element: CertificateImageElement, context: CertificateVariableContext): string {
  const source = imageSource(element, context);
  if (!source) return '';

  const style = `${commonStyle(element)};object-fit:${element.objectFit}`;

  return `<img class="certificate-layout-element certificate-layout-image" data-element-id="${escapeHtml(
    element.id
  )}" src="${escapeHtml(source)}" alt="" style="${style}" />`;
}

export function renderCertificateLayoutBody(
  layout: CertificateLayout,
  data: CertificateRenderData
): { body: string; styles: string } {
  const context = toCertificateVariableContext(data);
  const backgroundImage = layout.page.backgroundImageUrl
    ? `<img class="certificate-layout-background" src="${escapeHtml(layout.page.backgroundImageUrl)}" alt="" />`
    : '';
  const elements = [...layout.elements]
    .sort((leftElement, rightElement) => leftElement.zIndex - rightElement.zIndex)
    .map((element) =>
      element.type === 'image' ? renderImageElement(element, context) : renderTextElement(element, context)
    )
    .join('\n');
  const backgroundOpacity = Math.max(0, Math.min(1, layout.page.backgroundImageOpacity ?? 1));
  const body = `<div class="cert certificate-layout-v1">
    ${backgroundImage}
    ${elements}
  </div>`;
  const styles = `
    @page { size: ${layout.page.width}px ${layout.page.height}px; margin: 0; }
    html, body { width: ${layout.page.width}px; height: ${layout.page.height}px; overflow: hidden; }
    .certificate-layout-v1 {
      position: relative;
      width: ${layout.page.width}px;
      height: ${layout.page.height}px;
      overflow: hidden;
      background: ${layout.page.backgroundColor};
      box-shadow: none;
    }
    .certificate-layout-background {
      position: absolute;
      inset: 0;
      z-index: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: ${backgroundOpacity};
      pointer-events: none;
    }
    .certificate-layout-element { box-sizing: border-box; }
    .certificate-layout-image { display: block; }
  `;

  return { body, styles };
}
