import { describe, expect, it } from "vitest";

import {
  evaluateApproval,
  evaluateDeployState,
  evaluateDeployValidation,
} from "@/lib/content/content-workflow";

describe("deploy gate (P0-9)", () => {
  it("BLOCKS deploy from EN_REVIEW_REQUIRED", () => {
    const r = evaluateDeployState({
      status: "EN_REVIEW_REQUIRED",
      hasEnglish: true,
      hasKannada: false,
    });
    expect(r.ok).toBe(false);
  });

  it("BLOCKS deploy from KN_REVIEW_REQUIRED (bilingual not approved)", () => {
    const r = evaluateDeployState({
      status: "KN_REVIEW_REQUIRED",
      hasEnglish: true,
      hasKannada: true,
    });
    expect(r.ok).toBe(false);
  });

  it("BLOCKS deploy from EN_APPROVED (Kannada not yet approved)", () => {
    const r = evaluateDeployState({
      status: "EN_APPROVED",
      hasEnglish: true,
      hasKannada: false,
    });
    expect(r.ok).toBe(false);
  });

  it("BLOCKS deploy when Kannada content is missing even if KN_APPROVED", () => {
    const r = evaluateDeployState({
      status: "KN_APPROVED",
      hasEnglish: true,
      hasKannada: false,
    });
    expect(r.ok).toBe(false);
  });

  it("ALLOWS the state gate at KN_APPROVED with both languages", () => {
    const r = evaluateDeployState({
      status: "KN_APPROVED",
      hasEnglish: true,
      hasKannada: true,
    });
    expect(r.ok).toBe(true);
  });

  it("ALLOWS idempotent re-deploy of already-VALIDATED content", () => {
    const r = evaluateDeployState({
      status: "VALIDATED",
      hasEnglish: true,
      hasKannada: true,
    });
    expect(r.ok).toBe(true);
  });

  it("still blocks DRAFT/BLOCKED content", () => {
    expect(
      evaluateDeployState({ status: "DRAFT", hasEnglish: true, hasKannada: true }).ok,
    ).toBe(false);
    expect(
      evaluateDeployState({ status: "BLOCKED", hasEnglish: true, hasKannada: true }).ok,
    ).toBe(false);
  });

  it("BLOCKS deploy when English validation fails (e.g. unsupported/unverified claim)", () => {
    expect(
      evaluateDeployValidation({ englishValid: false, kannadaValid: true }).ok,
    ).toBe(false);
  });

  it("BLOCKS deploy when Kannada validation fails", () => {
    expect(
      evaluateDeployValidation({ englishValid: true, kannadaValid: false }).ok,
    ).toBe(false);
  });

  it("ALLOWS deploy only when both validations pass", () => {
    expect(
      evaluateDeployValidation({ englishValid: true, kannadaValid: true }).ok,
    ).toBe(true);
  });
});

describe("approval gate (P0-4)", () => {
  it("approves English only when English validation passes", () => {
    const ok = evaluateApproval({
      stage: "EN",
      status: "EN_REVIEW_REQUIRED",
      hasKannada: false,
      englishValid: true,
      kannadaValid: true,
    });
    expect(ok).toEqual({ ok: true, nextStatus: "EN_APPROVED" });
  });

  it("refuses English approval when validation fails", () => {
    const r = evaluateApproval({
      stage: "EN",
      status: "EN_REVIEW_REQUIRED",
      hasKannada: false,
      englishValid: false,
      kannadaValid: true,
    });
    expect(r.ok).toBe(false);
  });

  it("refuses Kannada approval when no Kannada content exists", () => {
    const r = evaluateApproval({
      stage: "KN",
      status: "EN_APPROVED",
      hasKannada: false,
      englishValid: true,
      kannadaValid: true,
    });
    expect(r.ok).toBe(false);
  });

  it("refuses Kannada approval when Kannada validation fails", () => {
    const r = evaluateApproval({
      stage: "KN",
      status: "KN_REVIEW_REQUIRED",
      hasKannada: true,
      englishValid: true,
      kannadaValid: false,
    });
    expect(r.ok).toBe(false);
  });

  it("approves Kannada when both validations pass and Kannada exists", () => {
    const r = evaluateApproval({
      stage: "KN",
      status: "KN_REVIEW_REQUIRED",
      hasKannada: true,
      englishValid: true,
      kannadaValid: true,
    });
    expect(r).toEqual({ ok: true, nextStatus: "KN_APPROVED" });
  });

  it("refuses any approval on BLOCKED content", () => {
    const r = evaluateApproval({
      stage: "EN",
      status: "BLOCKED",
      hasKannada: false,
      englishValid: true,
      kannadaValid: true,
    });
    expect(r.ok).toBe(false);
  });
});
