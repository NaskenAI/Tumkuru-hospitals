/**
 * Accreditation-taxonomy safety (Step 14).
 *
 * Hospital accreditation and a person's professional-society membership are
 * different concepts. Even if upstream data mis-classifies a doctor's membership
 * as an ACCREDITATION fact, the accreditation UI must never render it as a
 * hospital recognition. This guard filters membership/affiliation-style claims.
 */
export function isHospitalAccreditation(text: string): boolean {
  const t = text.toLowerCase();
  // Personal membership / affiliation language — not a hospital accreditation.
  if (/\b(member|membership|fellow|fellowship|affiliat)/.test(t)) return false;
  // Mentions a named doctor → a personal credential, not a facility accreditation.
  if (/\bdr\.?\s/.test(t)) return false;
  return true;
}
