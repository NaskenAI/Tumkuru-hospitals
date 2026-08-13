import { describe, expect, it } from "vitest";

import {
  isPubliclyEligible,
  mapClassification,
  normalizeAssetRow,
  reconcileApprovalState,
  type PersistedAssetRow,
} from "@/lib/normalize/assets";

function row(over: Partial<PersistedAssetRow>): PersistedAssetRow {
  return {
    id: "a1",
    source_id: "s1",
    source_page_url: "https://h/facilities/",
    original_asset_url: "https://h/u/pic-1024x600.jpg",
    mime_type: "image/jpeg",
    width: 1024,
    height: 600,
    alt_text: null,
    classification: "HOSPITAL_EXTERIOR",
    approval_status: "APPROVED",
    ...over,
  };
}

describe("persisted asset → normalized Asset", () => {
  it("maps fields and retains source provenance", () => {
    const a = normalizeAssetRow(row({ alt_text: "Front view" }));
    expect(a.classification).toBe("EXTERIOR");
    expect(a.original_url).toContain("pic-1024x600.jpg");
    expect(a.source_page_url).toBe("https://h/facilities/");
    expect(a.aspect).toBeCloseTo(1024 / 600);
    expect(a.evidence[0].sourceUrl).toBe("https://h/facilities/");
    // never fabricates vision scores
    expect(a.crowding).toBe("unknown");
    expect(a.technical_quality).toBeNull();
    expect(a.composition_quality).toBeNull();
  });

  it("classifies an architectural render, never as a photograph", () => {
    const a = normalizeAssetRow(row({ original_asset_url: "https://h/u/3d-elevation-render.jpg" }));
    expect(a.classification).toBe("RENDER");
    expect(a.is_photograph).toBe(false);
  });
});

describe("approval reconciliation (SAFETY)", () => {
  it("maps the persisted 3-state column safely", () => {
    expect(reconcileApprovalState("REJECTED", "EXTERIOR")).toBe("REJECTED");
    expect(reconcileApprovalState("APPROVED", "EXTERIOR")).toBe("AUTO_APPROVED");
    expect(reconcileApprovalState("APPROVED", "LOGO")).toBe("AUTO_APPROVED");
    // attributive stays REVIEW_REQUIRED even if the old column said APPROVED
    expect(reconcileApprovalState("APPROVED", "PORTRAIT")).toBe("REVIEW_REQUIRED");
    expect(reconcileApprovalState("APPROVED", "FACILITY")).toBe("REVIEW_REQUIRED");
    expect(reconcileApprovalState("PENDING", "EXTERIOR")).toBe("REVIEW_REQUIRED");
    expect(reconcileApprovalState("PENDING", "PORTRAIT")).toBe("REVIEW_REQUIRED");
  });

  it("REVIEW_REQUIRED and REJECTED are never publicly eligible", () => {
    expect(isPubliclyEligible("REVIEW_REQUIRED")).toBe(false);
    expect(isPubliclyEligible("REJECTED")).toBe(false);
    expect(isPubliclyEligible("DISCOVERED")).toBe(false);
    expect(isPubliclyEligible("AUTO_APPROVED")).toBe(true);
    expect(isPubliclyEligible("HUMAN_APPROVED")).toBe(true);
  });

  it("a PENDING doctor portrait can never become publicly eligible", () => {
    const a = normalizeAssetRow(row({ classification: "DOCTOR", approval_status: "PENDING", original_asset_url: "https://h/u/dr-y.jpg" }));
    expect(a.classification).toBe("PORTRAIT");
    expect(a.approval_state).toBe("REVIEW_REQUIRED");
    expect(isPubliclyEligible(a.approval_state)).toBe(false);
  });
});

describe("classification mapping", () => {
  it("maps the extractor vocabulary to the normalized classes", () => {
    expect(mapClassification("HERO")).toBe("EXTERIOR");
    expect(mapClassification("HOSPITAL_INTERIOR")).toBe("INTERIOR");
    expect(mapClassification("DOCTOR")).toBe("PORTRAIT");
    expect(mapClassification("DEPARTMENT")).toBe("FACILITY");
    expect(mapClassification("INSURANCE_LOGO")).toBe("INSURER_MARK");
    expect(mapClassification("GALLERY")).toBe("OTHER");
  });
});
