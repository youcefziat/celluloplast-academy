import { CLOUDFLARE } from '@api/constants';

export type ScreenshotViewport = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
};

function assertBrowserRenderingConfigured() {
  if (CLOUDFLARE.CONFIGS.ACCOUNT_ID && CLOUDFLARE.CONFIGS.RENDERING_API_KEY) return;

  throw new Error(
    'Cloudflare Browser Rendering is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_RENDERING_API_KEY.'
  );
}

async function readRenderedBinary(
  response: Response,
  format: 'PDF' | 'PNG',
  hasExpectedSignature: (buffer: Buffer) => boolean
) {
  if (!response.ok) {
    throw new Error(`Cloudflare ${format} rendering failed with HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!hasExpectedSignature(buffer)) {
    throw new Error(`Cloudflare ${format} rendering returned an invalid ${format} payload`);
  }

  return buffer;
}

export const getCloudflarePdfBuffer = async (html: string, styles?: string) => {
  console.log('Generating PDF with Cloudflare API...');
  try {
    assertBrowserRenderingConfigured();

    const pdfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE.CONFIGS.ACCOUNT_ID}/browser-rendering/pdf`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CLOUDFLARE.CONFIGS.RENDERING_API_KEY}`
        },
        body: JSON.stringify({
          html: html,
          addStyleTag: [{ content: `${styles}` }]
        })
      }
    );

    console.log('PDF response status:', pdfResponse.status);
    return readRenderedBinary(pdfResponse, 'PDF', (buffer) => buffer.subarray(0, 5).toString() === '%PDF-');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate PDF');
  }
};

/**
 * Renders HTML to a PNG via Cloudflare Browser Rendering's `/screenshot` endpoint.
 * Defaults to 1100x780 for certificate canvases; pass a custom viewport for other assets.
 */
export const getCloudflarePngBuffer = async (
  html: string,
  styles?: string,
  viewport: ScreenshotViewport = { width: 1100, height: 780, deviceScaleFactor: 2 }
) => {
  console.log('Generating PNG with Cloudflare API...');
  try {
    assertBrowserRenderingConfigured();

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE.CONFIGS.ACCOUNT_ID}/browser-rendering/screenshot`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CLOUDFLARE.CONFIGS.RENDERING_API_KEY}`
        },
        body: JSON.stringify({
          html,
          addStyleTag: styles ? [{ content: styles }] : undefined,
          viewport: {
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: viewport.deviceScaleFactor ?? 2
          },
          screenshotOptions: { type: 'png', omitBackground: false, fullPage: false }
        })
      }
    );

    console.log('PNG response status:', response.status);
    return readRenderedBinary(response, 'PNG', (buffer) =>
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  } catch (error) {
    console.error('Error generating PNG:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate PNG');
  }
};
