/**
 * Projection of the NormalizedHospital that is safe to ship to the client for
 * rendering. Positioning/marketing claims are NEVER sent (no component uses
 * them, and they must not appear in the page payload at all); evidence arrays
 * are stripped to slim the payload (components don't read provenance at render).
 */

import { isPubliclyEligible } from "@/lib/normalize/assets";
import type { NormalizedHospital } from "@/lib/normalize/model";

function stripEvidence(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(stripEvidence);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if ("evidence" in obj) obj.evidence = [];
    for (const v of Object.values(obj)) stripEvidence(v);
  }
}

export function toRenderModel(model: NormalizedHospital): NormalizedHospital {
  const clone = JSON.parse(JSON.stringify(model)) as NormalizedHospital;
  // Marketing/positioning language never reaches the client.
  clone.positioningClaims = [];
  // Ship ONLY publicly-eligible assets, and never their upstream source URL
  // (which can itself carry marketing words in the filename). The client uses
  // the same-origin proxy keyed by asset_id.
  clone.assets = clone.assets
    .filter((a) => isPubliclyEligible(a.approval_state))
    .map((a) => ({ ...a, original_url: `/api/assets/${a.asset_id}`, caption: null }));
  // Provenance is a server-side concern; not needed to render.
  stripEvidence(clone);
  return clone;
}
