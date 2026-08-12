import { describe, expect, it } from "vitest";

import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  capturePreviewScreenshots,
  type CaptureFn,
} from "@/lib/screenshots/capture";
import { createInMemoryScreenshotStore } from "@/lib/screenshots/store";

describe("capturePreviewScreenshots", () => {
  it("captures desktop and mobile at the correct viewports", async () => {
    const seen: Array<{ w: number; h: number; fullPage: boolean }> = [];
    const capture: CaptureFn = async ({ viewport, fullPage }) => {
      seen.push({ w: viewport.width, h: viewport.height, fullPage });
      return new Uint8Array([1, 2, 3]);
    };

    const result = await capturePreviewScreenshots({
      url: "http://localhost:3000/preview/x",
      capture,
    });

    expect(result.ok).toBe(true);
    expect(seen).toEqual([
      { w: DESKTOP_VIEWPORT.width, h: DESKTOP_VIEWPORT.height, fullPage: true },
      { w: MOBILE_VIEWPORT.width, h: MOBILE_VIEWPORT.height, fullPage: true },
    ]);
  });

  it("never throws — returns { ok: false } on capture failure (retryable)", async () => {
    const capture: CaptureFn = async () => {
      throw new Error("browser crashed");
    };
    const result = await capturePreviewScreenshots({
      url: "http://localhost:3000/preview/x",
      capture,
    });
    expect(result).toEqual({ ok: false, error: "browser crashed" });
  });

  it("persists both images through a store", async () => {
    const { store, saved } = createInMemoryScreenshotStore();
    const capture: CaptureFn = async ({ viewport }) =>
      new Uint8Array([viewport.width === 1440 ? 13 : 37]);

    const result = await capturePreviewScreenshots({
      url: "http://localhost:3000/preview/abc",
      capture,
    });
    if (!result.ok) throw new Error("expected ok");

    const desktopPath = await store.save({
      key: "abc/desktop.png",
      bytes: result.desktop,
      contentType: "image/png",
    });
    const mobilePath = await store.save({
      key: "abc/mobile.png",
      bytes: result.mobile,
      contentType: "image/png",
    });

    expect(desktopPath).toContain("abc/desktop.png");
    expect(mobilePath).toContain("abc/mobile.png");
    expect(saved.size).toBe(2);
  });
});
