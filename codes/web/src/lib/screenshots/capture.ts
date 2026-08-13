/**
 * Preview screenshot capture (Phase 2, step 3).
 *
 * The orchestration is decoupled from Playwright via an injectable CaptureFn so
 * it is unit-testable without a browser, and so the whole hospital pipeline is
 * not coupled to a heavyweight optional dependency. The default capturer loads
 * Playwright dynamically; if it is not installed the capture fails cleanly and
 * the stage is recorded as failed + retryable (never crashes the pipeline).
 */

import { NASKEN_SCREENSHOT_UA } from "@/lib/analytics/automation";

export type Viewport = { width: number; height: number };

export const DESKTOP_VIEWPORT: Viewport = { width: 1440, height: 900 };
export const MOBILE_VIEWPORT: Viewport = { width: 390, height: 844 };

export type ScreenshotBytes = Uint8Array;

export type CaptureFn = (input: {
  url: string;
  viewport: Viewport;
  fullPage: boolean;
}) => Promise<ScreenshotBytes>;

export type CaptureResult =
  | { ok: true; desktop: ScreenshotBytes; mobile: ScreenshotBytes }
  | { ok: false; error: string };

/**
 * Capture desktop (1440×900) and mobile (390×844) full-page screenshots of a
 * preview URL. Never throws — returns { ok: false, error } on any failure so
 * the caller can record the stage failure and allow retry.
 */
export async function capturePreviewScreenshots(input: {
  url: string;
  capture?: CaptureFn;
}): Promise<CaptureResult> {
  const capture = input.capture ?? playwrightCapture;
  try {
    const desktop = await capture({
      url: input.url,
      viewport: DESKTOP_VIEWPORT,
      fullPage: true,
    });
    const mobile = await capture({
      url: input.url,
      viewport: MOBILE_VIEWPORT,
      fullPage: true,
    });
    return { ok: true, desktop, mobile };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Minimal structural typing for the parts of Playwright we use, so we can load
// it via a variable specifier (no compile-time module resolution / no `any`).
type PlaywrightModule = {
  chromium: {
    launch: (opts?: unknown) => Promise<{
      newPage: (opts?: {
        viewport?: Viewport;
        deviceScaleFactor?: number;
        userAgent?: string;
      }) => Promise<{
        goto: (url: string, opts?: unknown) => Promise<unknown>;
        screenshot: (opts?: {
          fullPage?: boolean;
          type?: string;
        }) => Promise<Uint8Array>;
      }>;
      close: () => Promise<void>;
    }>;
  };
};

export const playwrightCapture: CaptureFn = async ({ url, viewport, fullPage }) => {
  const specifier = "playwright";
  let pw: PlaywrightModule;
  try {
    pw = (await import(specifier)) as unknown as PlaywrightModule;
  } catch {
    throw new Error(
      "playwright is not installed. Enable screenshots with: npm i -D playwright && npx playwright install chromium",
    );
  }

  const browser = await pw.chromium.launch();
  try {
    // Identify as the internal bot so preview opens by the screenshot job are
    // excluded from prospect-engagement analytics.
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 2,
      userAgent: NASKEN_SCREENSHOT_UA,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    return await page.screenshot({ fullPage, type: "png" });
  } finally {
    await browser.close();
  }
};
