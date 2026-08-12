import { describe, expect, it } from "vitest";

import {
  assertSafeHttpUrl,
  isPrivateOrReservedAddress,
  parseSafeHttpUrl,
} from "@/lib/research/safe-url";

describe("safe URL checks", () => {
  it("allows only http and https schemes", () => {
    expect(() => parseSafeHttpUrl("file:///etc/passwd")).toThrow(
      "Only http and https URLs are allowed.",
    );
  });

  it("blocks localhost names before fetching", () => {
    expect(() => parseSafeHttpUrl("http://localhost/admin")).toThrow(
      "Localhost URLs are not allowed.",
    );
  });

  it("rejects non-standard ports", () => {
    expect(() => parseSafeHttpUrl("http://example.com:8080/")).toThrow(
      "Port 8080 is not allowed.",
    );
    expect(() => parseSafeHttpUrl("http://example.com:22/")).toThrow(
      "not allowed",
    );
    // Standard ports and the default are fine.
    expect(() => parseSafeHttpUrl("https://example.com:443/")).not.toThrow();
    expect(() => parseSafeHttpUrl("http://example.com/")).not.toThrow();
  });

  it("detects private and reserved addresses", () => {
    expect(isPrivateOrReservedAddress("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedAddress("10.10.10.10")).toBe(true);
    expect(isPrivateOrReservedAddress("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedAddress("8.8.8.8")).toBe(false);
  });

  it("rejects hostnames that resolve to private addresses", async () => {
    await expect(
      assertSafeHttpUrl("https://example.com", async () => [
        { address: "192.168.0.10", family: 4 },
      ]),
    ).rejects.toThrow("private or reserved");
  });
});
