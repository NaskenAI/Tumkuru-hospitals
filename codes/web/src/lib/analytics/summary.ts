/**
 * Preview analytics summary (Phase 2, step 4). Pure aggregation + a simple
 * rule-based engagement label (NOT predictive AI).
 */

import type { AnalyticsEvent } from "@/lib/database/types";

export type AnalyticsEventRow = {
  event: AnalyticsEvent;
  created_at: string;
};

export type EngagementLabel = "NOT VIEWED" | "VIEWED" | "ENGAGED";

export type AnalyticsSummary = {
  opens: number;
  lastOpened: string | null;
  callClicks: number;
  whatsappClicks: number;
  directionsClicks: number;
  contactClicks: number;
  totalCtaClicks: number;
  label: EngagementLabel;
};

const CTA_EVENTS: AnalyticsEvent[] = [
  "call_clicked",
  "whatsapp_clicked",
  "directions_clicked",
  "contact_clicked",
];

export function engagementLabel(
  opens: number,
  ctaClicks: number,
): EngagementLabel {
  if (ctaClicks > 0) return "ENGAGED";
  if (opens > 0) return "VIEWED";
  return "NOT VIEWED";
}

export function summarizeEvents(events: AnalyticsEventRow[]): AnalyticsSummary {
  const count = (e: AnalyticsEvent) =>
    events.filter((row) => row.event === e).length;

  // "opens" counts both the server-side preview_opened and client page_viewed.
  const opens =
    count("preview_opened") + count("page_viewed");

  const opensTimes = events
    .filter((r) => r.event === "preview_opened" || r.event === "page_viewed")
    .map((r) => r.created_at)
    .sort();
  const lastOpened = opensTimes.length > 0 ? opensTimes[opensTimes.length - 1] : null;

  const callClicks = count("call_clicked");
  const whatsappClicks = count("whatsapp_clicked");
  const directionsClicks = count("directions_clicked");
  const contactClicks = count("contact_clicked");
  const totalCtaClicks = CTA_EVENTS.reduce((sum, e) => sum + count(e), 0);

  return {
    opens,
    lastOpened,
    callClicks,
    whatsappClicks,
    directionsClicks,
    contactClicks,
    totalCtaClicks,
    label: engagementLabel(opens, totalCtaClicks),
  };
}
