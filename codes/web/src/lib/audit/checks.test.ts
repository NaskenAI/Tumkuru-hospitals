import { describe, expect, it } from "vitest";

import { runAllAuditChecks } from "@/lib/audit/checks";

const realHtml = `<!doctype html>
<html>
  <head>
    <title>ABC Hospital, Tumakuru</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Multispecialty hospital in Tumakuru." />
  </head>
  <body>
    <h1>ABC Hospital</h1>
    <a href="tel:+918161234567">Call us</a>
    <a href="https://wa.me/918161234567">WhatsApp</a>
    <a href="https://maps.google.com/?q=ABC+Hospital+Tumakuru">Directions</a>
    <p>Cardiology and Orthopedics departments. Book an appointment.</p>
    <p>Dr. Rao, MBBS.</p>
  </body>
</html>`;

// Directions link present but no WhatsApp — proves the maps href is detected.
const directionsOnlyHtml = `<!doctype html>
<html><head><title>XYZ Clinic</title>
<meta name="viewport" content="width=device-width" /></head>
<body><a href="https://maps.google.com/?q=XYZ">Get directions</a></body></html>`;

// What the OLD pipeline stored: visible text only, tags stripped.
const strippedText =
  "ABC Hospital, Tumakuru ABC Hospital Call us WhatsApp Cardiology and Orthopedics departments. Book an appointment. Dr. Rao, MBBS.";

function checkByName(html: string, name: string) {
  const result = runAllAuditChecks({
    websiteUrl: "https://abc.example",
    httpStatus: 200,
    rawHtml: html,
  });
  return result.checks.find((c) => c.name === name);
}

describe("website audit structural checks", () => {
  it("passes structural checks against real HTML", () => {
    expect(checkByName(realHtml, "mobile_viewport")?.passed).toBe(true);
    expect(checkByName(realHtml, "title_tag")?.passed).toBe(true);
    expect(checkByName(realHtml, "meta_description")?.passed).toBe(true);
    // tel: link present
    expect(checkByName(realHtml, "call_cta")?.passed).toBe(true);
    // wa.me + maps hrefs present
    expect(checkByName(realHtml, "whatsapp_directions")?.passed).toBe(true);
    const detail = checkByName(realHtml, "whatsapp_directions")?.detail ?? "";
    expect(detail).toContain("WhatsApp");
    expect(detail).toContain("Directions");
  });

  it("detects a directions (maps) CTA even without WhatsApp", () => {
    const check = checkByName(directionsOnlyHtml, "whatsapp_directions");
    expect(check?.passed).toBe(true);
    expect(check?.detail).toContain("Directions");
  });

  it("does NOT count 'Dr. <non-medical name>' as a doctor listing (regression)", () => {
    // Real false positive from the Tumakuru District Hospital gov page:
    // "Dr.B.R. Ambedkar Development Corporation" must NOT pass doctors_listed.
    const html =
      "<html><body><p>Dr.B.R. Ambedkar Development Corporation LTD</p><p>Kunigal Road</p></body></html>";
    expect(checkByName(html, "doctors_listed")?.passed).toBe(false);
  });

  it("counts a real doctor roster", () => {
    const withWord =
      "<html><body><h2>Our Doctors</h2><p>Consultant physician on duty.</p></body></html>";
    expect(checkByName(withWord, "doctors_listed")?.passed).toBe(true);

    const drPlusQual =
      "<html><body><p>Dr. Meena Rao, MBBS, MS</p></body></html>";
    expect(checkByName(drPlusQual, "doctors_listed")?.passed).toBe(true);
  });

  it("would falsely fail structural checks on stripped text (the P0-2 bug)", () => {
    // This documents why raw_html is required: tag/attribute checks cannot
    // succeed on text that has had all markup removed.
    expect(checkByName(strippedText, "mobile_viewport")?.passed).toBe(false);
    expect(checkByName(strippedText, "title_tag")?.passed).toBe(false);
    expect(checkByName(strippedText, "meta_description")?.passed).toBe(false);
  });
});
