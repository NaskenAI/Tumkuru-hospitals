/**
 * Configurable scoring (P1).
 *
 * Weights were previously hardcoded in score.ts. They now live here with a
 * documented default and an optional override via the SCORING_CONFIG_JSON env
 * var (a partial JSON object deep-merged over the defaults). Defaults reproduce
 * the original behaviour exactly.
 */

export type FitWeights = {
  name: number;
  phone: number;
  address: number;
  hours: number;
  specialtyPer: number;
  specialtyMax: number;
  doctorPer: number;
  doctorMax: number;
  servicePer: number;
  serviceMax: number;
  richnessMax: number;
};

export type ScoringConfig = {
  auditWeights: Record<string, number>;
  fit: FitWeights;
  priority: { gapWeight: number; fitWeight: number };
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  auditWeights: {
    website_exists: 20,
    https: 5,
    mobile_viewport: 15,
    title_tag: 5,
    meta_description: 5,
    call_cta: 10,
    appointment_cta: 15,
    whatsapp_directions: 5,
    doctors_listed: 5,
    specialties_listed: 5,
    not_outdated: 10,
  },
  fit: {
    name: 10,
    phone: 10,
    address: 10,
    hours: 10,
    specialtyPer: 5,
    specialtyMax: 20,
    doctorPer: 5,
    doctorMax: 15,
    servicePer: 3,
    serviceMax: 15,
    richnessMax: 10,
  },
  priority: { gapWeight: 0.4, fitWeight: 0.6 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Shallow-per-section merge of a partial override onto the defaults. */
export function mergeScoringConfig(override: unknown): ScoringConfig {
  if (!isRecord(override)) return DEFAULT_SCORING_CONFIG;

  const auditWeights = isRecord(override.auditWeights)
    ? { ...DEFAULT_SCORING_CONFIG.auditWeights, ...override.auditWeights }
    : DEFAULT_SCORING_CONFIG.auditWeights;

  const fit = isRecord(override.fit)
    ? { ...DEFAULT_SCORING_CONFIG.fit, ...override.fit }
    : DEFAULT_SCORING_CONFIG.fit;

  const priority = isRecord(override.priority)
    ? { ...DEFAULT_SCORING_CONFIG.priority, ...override.priority }
    : DEFAULT_SCORING_CONFIG.priority;

  return { auditWeights, fit, priority } as ScoringConfig;
}

export function loadScoringConfig(): ScoringConfig {
  const raw = process.env.SCORING_CONFIG_JSON;
  if (!raw) return DEFAULT_SCORING_CONFIG;
  try {
    return mergeScoringConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_SCORING_CONFIG;
  }
}
