/**
 * Shared, generic text utilities for normalization. No hospital-specific terms.
 */

export function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// --- Placeholder / editor boilerplate (Section 20) --------------------------

const PLACEHOLDER_RE =
  /(lorem ipsum|dolor sit amet|click edit button to change this text|add your (own )?text|your (content|text) (goes )?here|edit this (text|content)|placeholder text|sample text|insert your content|this is a (sample|dummy))/i;

/** True when a block is editor/template boilerplate that must not enter narrative. */
export function isPlaceholderText(text: string): boolean {
  return PLACEHOLDER_RE.test(text);
}

// --- Marketing / superlatives (Section 21) ----------------------------------

// Whole-word superlative / positioning markers. These never become neutral
// facts — only positioning_claims.
const SUPERLATIVE_RE = new RegExp(
  "\\b(" +
    [
      "#\\s?1",
      "no\\.?\\s?1",
      "number one",
      "best",
      "leading",
      "premier",
      "premiere",
      "renowned",
      "world[- ]?class",
      "state[- ]?of[- ]?the[- ]?art",
      "finest",
      "superior",
      "beacon of hope",
      "unparalleled",
      "unmatched",
      "most trusted",
      "top[- ]?rated",
      "cutting[- ]?edge",
      "only premier",
      "excellence in",
    ].join("|") +
    ")\\b",
  "i",
);

export function containsSuperlative(text: string): boolean {
  return SUPERLATIVE_RE.test(text);
}

// --- Name / label normalization ---------------------------------------------

const SMALL_WORDS = new Set(["and", "of", "the", "for", "in", "&", "to"]);

/** Title-case a SHOUTING or lower label while keeping small words + acronyms. */
export function titleCaseLabel(label: string): string {
  const cleaned = collapseWs(label).toLowerCase();
  return cleaned
    .split(" ")
    .map((w, i) => {
      if (w === "&") return "&";
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      // keep short all-caps acronyms if the original token was uppercase
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Normalize a clinician name: collapse whitespace, standardize the "Dr" prefix
 * to "Dr." and title-case tokens while preserving single-letter initials.
 */
export function normalizeDoctorName(raw: string): string {
  let s = collapseWs(raw).replace(/^dr\.?\s+/i, "Dr. ");
  if (!/^Dr\.\s/.test(s) && /^dr/i.test(raw)) s = "Dr. " + s.replace(/^dr\.?\s*/i, "");
  return s
    .split(" ")
    .map((tok) => {
      if (tok === "Dr.") return tok;
      if (/^[A-Za-z]\.?$/.test(tok)) return tok.toUpperCase().replace(/\.?$/, ".");
      return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The name tokens after the "Dr." prefix (for collision detection). */
export function nameTokens(displayName: string): string[] {
  return displayName
    .replace(/^Dr\.?\s*/i, "")
    .split(/\s+/)
    .map((t) => t.replace(/\./g, "").toLowerCase())
    .filter(Boolean);
}

/** Words from a filename slug (last path segment, no extension/size suffix). */
export function filenameWords(url: string): string[] {
  return assetBaseKey(url).split(/[-_]+/).filter(Boolean);
}

/**
 * Identity key for an image ignoring WordPress resize variants, so the og:image
 * (full size) matches a stored "-1024x533"/"-scaled" derivative of the same file.
 */
export function assetBaseKey(url: string): string {
  return (url.split(/[?#]/)[0].split("/").pop() ?? "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/-scaled$/i, "")
    .replace(/-\d{2,4}x\d{2,4}$/i, "")
    .replace(/-scaled$/i, "");
}
