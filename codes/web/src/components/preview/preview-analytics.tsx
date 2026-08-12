"use client";

import { useEffect } from "react";

type PreviewAnalyticsProps = {
  slug: string;
};

function deviceCategory(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const coarse =
    window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const narrow = window.innerWidth > 0 && window.innerWidth < 768;
  return coarse || narrow ? "mobile" : "desktop";
}

function send(slug: string, event: string, device: string) {
  const payload = JSON.stringify({ slug, event, deviceCategory: device });
  // Prefer sendBeacon so events survive navigation (e.g. tel: handoff).
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics", blob);
    return;
  }
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Client-side preview analytics (P1). Records a device-categorised page_viewed
 * on mount and forwards clicks on any element carrying data-analytics-event.
 */
export function PreviewAnalytics({ slug }: PreviewAnalyticsProps) {
  useEffect(() => {
    const device = deviceCategory();
    send(slug, "page_viewed", device);

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("[data-analytics-event]");
      const event = el?.dataset.analyticsEvent;
      if (event) {
        send(slug, event, device);
      }
    }

    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, [slug]);

  return null;
}
