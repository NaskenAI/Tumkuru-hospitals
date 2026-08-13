import type { Data } from "@measured/puck";

import type { GeneratedContent } from "@/lib/content/content-schema";
import { availableActions } from "@/lib/puck/actions";
import {
  HOSPITAL_COMPONENT_TYPES,
  type HospitalComponentType,
} from "@/lib/puck/component-types";

type Item = { type: HospitalComponentType; props: Record<string, unknown> };

/**
 * Deterministic initial Puck page built from APPROVED content only. A section is
 * added only when its supporting data exists (no empty regions). No LLM.
 */
export function defaultPuckPage(content: GeneratedContent): Data {
  const has = {
    specialties: (content.specialties?.length ?? 0) > 0,
    doctors: (content.doctors?.length ?? 0) > 0,
    about: (content.about?.length ?? 0) > 0,
    accreditations: (content.accreditations?.length ?? 0) > 0,
    insurance: (content.insurance?.length ?? 0) > 0,
    emergency: Boolean(content.contact.emergency),
    address: Boolean(content.contact.address),
    contact: Boolean(
      content.contact.phone ||
        content.contact.email ||
        content.contact.address ||
        content.contact.hours,
    ),
    services: (content.services?.length ?? 0) > 0,
    appointment: availableActions(content).some((a) => a.kind === "appointment"),
  };
  const anyStat = has.specialties || has.doctors || has.services;

  const items: Array<Item | null> = [
    { type: "HospitalNavbar", props: {} },
    // Image-overlay hero: uses an approved first-party photo when one exists,
    // otherwise a designed brand panel (the component self-adapts).
    { type: "HospitalHero", props: { variant: "image-overlay" } },
    has.emergency ? { type: "EmergencyStrip", props: {} } : null,
    { type: "QuickActions", props: {} },
    anyStat ? { type: "StatsSection", props: {} } : null,
    has.specialties ? { type: "SpecialtyGrid", props: { variant: "cards" } } : null,
    // Real first-party photo band; self-hides when no approved photos exist.
    { type: "HospitalGallery", props: {} },
    has.about ? { type: "AboutHospital", props: { variant: "image-split" } } : null,
    has.doctors ? { type: "DoctorGrid", props: { variant: "cards" } } : null,
    has.accreditations ? { type: "AccreditationSection", props: {} } : null,
    has.insurance ? { type: "InsuranceSection", props: {} } : null,
    has.appointment ? { type: "AppointmentCTA", props: {} } : null,
    has.contact ? { type: "ContactSection", props: { variant: "cards" } } : null,
    has.address ? { type: "MapOrDirectionsSection", props: {} } : null,
    { type: "HospitalFooter", props: {} },
  ];

  const content_ = items
    .filter((x): x is Item => x !== null)
    .map((it, i) => ({
      type: it.type as string,
      props: { id: `${it.type}-${i}`, ...it.props },
    }));

  return {
    root: { props: {} },
    content: content_,
    zones: {},
  } as Data;
}

/**
 * Fail-safe: keep only components in the allowlist. Unknown/unsupported
 * component types in stored Puck data are dropped rather than rendered.
 */
export function sanitizePuckData(data: Data): Data {
  const allowed = new Set<string>(HOSPITAL_COMPONENT_TYPES as readonly string[]);
  const content = (data.content ?? []).filter((c) => allowed.has(c.type));
  return { ...data, content } as Data;
}
