import puppeteer, { type Browser } from 'puppeteer-core';

export type ScreenshotViewport = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
};

/** Certificate canvases are authored at this size; other assets pass their own viewport. */
const DEFAULT_VIEWPORT: Required<ScreenshotViewport> = { width: 1100, height: 780, deviceScaleFactor: 2 };

/** Chromium comes from the image, not from a bundled download. */
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium';

/** Rendering is a background operation; never let a hung page hold a request forever. */
const RENDER_TIMEOUT_MS = 30_000;

let browserPromise: Promise<Browser> | null = null;

/**
 * One Chromium for the process, reused across renders.
 *
 * Launching per request costs seconds and a lot of memory. The instance is dropped on
 * disconnect so the next render starts a fresh one rather than failing forever.
 */
async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null);

    if (existing?.connected) {
      return existing;
    }

    browserPromise = null;
  }

  browserPromise = puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      // Required in containers: no user namespaces, and /dev/shm is too small by default,
      // which makes Chromium crash on larger pages.
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none'
    ]
  });

  const browser = await browserPromise;

  browser.once('disconnected', () => {
    browserPromise = null;
  });

  return browser;
}

async function withPage<T>(
  html: string,
  styles: string | undefined,
  viewport: ScreenshotViewport,
  render: (page: Awaited<ReturnType<Browser['newPage']>>) => Promise<T>
): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor ?? DEFAULT_VIEWPORT.deviceScaleFactor
    });

    // `networkidle0` waits for the webfonts the certificate links to; without it the first
    // render can land on fallback fonts and shift the layout.
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: RENDER_TIMEOUT_MS });

    if (styles) {
      await page.addStyleTag({ content: styles });
    }

    // Style tags can pull further font files, and fonts.ready resolves only once they land.
    await page.evaluate(() => document.fonts.ready);

    return await render(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

function assertSignature(buffer: Buffer, format: 'PDF' | 'PNG', matches: boolean): Buffer {
  if (!matches) {
    throw new Error(`${format} rendering returned an invalid ${format} payload`);
  }

  return buffer;
}

export const getPdfBuffer = async (html: string, styles?: string) => {
  try {
    return await withPage(html, styles, DEFAULT_VIEWPORT, async (page) => {
      const pdf = await page.pdf({
        // The certificate layout declares `@page { size: <w>px <h>px }`; that wins when
        // present, and the authored canvas size applies to the template renderers that
        // declare no page rule of their own.
        preferCSSPageSize: true,
        width: `${DEFAULT_VIEWPORT.width}px`,
        height: `${DEFAULT_VIEWPORT.height}px`,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        timeout: RENDER_TIMEOUT_MS
      });

      const buffer = Buffer.from(pdf);

      return assertSignature(buffer, 'PDF', buffer.subarray(0, 5).toString() === '%PDF-');
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate PDF');
  }
};

export const getPngBuffer = async (html: string, styles?: string, viewport: ScreenshotViewport = DEFAULT_VIEWPORT) => {
  try {
    return await withPage(html, styles, viewport, async (page) => {
      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: false,
        fullPage: false,
        captureBeyondViewport: false
      });

      const buffer = Buffer.from(screenshot);
      const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

      return assertSignature(buffer, 'PNG', buffer.subarray(0, 8).equals(pngSignature));
    });
  } catch (error) {
    console.error('Error generating PNG:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate PNG');
  }
};
