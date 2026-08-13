/**
 * Grounded call-to-action resolution for the Puck hospital site.
 *
 * CTAs are derived ONLY from approved content. Critically:
 *   - WhatsApp is NEVER inferred from a phone number. It requires an independent,
 *     approved WhatsApp destination (contact.whatsapp) — which the current
 *     content schema does not carry — so it never appears unless separately
 *     grounded. This closes the "phone exists → WhatsApp available" gap.
 *   - Appointment requires an approved appointment path (contact.appointment),
 *     not a phone number.
 */

import type { GeneratedContent } from "@/lib/content/content-schema";

export type HospitalActionKind =
  | "call"
  | "directions"
  | "whatsapp"
  | "appointment";

export type HospitalAction = {
  kind: HospitalActionKind;
  label: string;
  href: string;
};

export function directionsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address,
  )}`;
}

// Optional, independently-grounded contact channels the base schema does not yet
// model. Present only if extraction/approval added them.
type ExtendedContact = GeneratedContent["contact"] & {
  whatsapp?: string;
  appointment?: string;
};

export function availableActions(content: GeneratedContent): HospitalAction[] {
  const c = content.contact as ExtendedContact;
  const actions: HospitalAction[] = [];

  if (c.phone) {
    actions.push({ kind: "call", label: "Call hospital", href: `tel:${c.phone}` });
  }
  if (c.address) {
    actions.push({
      kind: "directions",
      label: "Get directions",
      href: directionsHref(c.address),
    });
  }
  // WhatsApp ONLY from an independently-approved destination — never from phone.
  if (c.whatsapp) {
    actions.push({ kind: "whatsapp", label: "WhatsApp", href: c.whatsapp });
  }
  // Appointment ONLY from an approved appointment path — never from phone.
  if (c.appointment) {
    actions.push({
      kind: "appointment",
      label: "Book appointment",
      href: c.appointment,
    });
  }

  return actions;
}
