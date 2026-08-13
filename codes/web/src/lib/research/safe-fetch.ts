import * as cheerio from "cheerio";

import {
  assertPublicHostname,
  parseSafeHttpUrl,
  defaultResolveHostname,
  type ResolvedAddress,
  type ResolveHostname,
} from "@/lib/research/safe-url";

export type FetchPageTextOptions = {
  fetchImpl?: typeof fetch;
  resolveHostname?: ResolveHostname;
  maxRedirects?: number;
  maxBytes?: number;
  timeoutMs?: number;
};

export type FetchedPageText = {
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  /** Visible text only (scripts/styles stripped) — used for LLM extraction. */
  rawText: string;
  /**
   * The raw HTML body (only when the response was HTML), preserved so the
   * deterministic website audit can inspect real tags/attributes such as
   * <meta name="viewport">, <title>, and <a href="tel:">. Null for non-HTML.
   */
  rawHtml: string | null;
  /** The page <title>, used as a human-readable source label. Null if absent. */
  title: string | null;
};

const defaultOptions = {
  maxRedirects: 3,
  maxBytes: 5 * 1024 * 1024,
  timeoutMs: 10_000,
};

export class FetchSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchSafetyError";
  }
}

export async function fetchPageText(
  input: string,
  options: FetchPageTextOptions = {},
): Promise<FetchedPageText> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHostname = options.resolveHostname ?? defaultResolveHostname;
  const maxRedirects = options.maxRedirects ?? defaultOptions.maxRedirects;
  const maxBytes = options.maxBytes ?? defaultOptions.maxBytes;
  const timeoutMs = options.timeoutMs ?? defaultOptions.timeoutMs;

  // Parse-only validation up front (protocol, port, localhost). DNS is resolved
  // and verified per hop inside the loop, and the connection is pinned to the
  // verified IP so a name cannot rebind to a private address between the check
  // and the connect (DNS-rebinding TOCTOU).
  let currentUrl = parseSafeHttpUrl(input);
  const usePinning = !options.fetchImpl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const addresses = await assertPublicHostname(
      currentUrl.hostname,
      resolveHostname,
    );
    const pinned = usePinning ? await createPinnedDispatcher(addresses[0]) : undefined;

    try {
      const response = await fetchWithTimeout(
        fetchImpl,
        currentUrl,
        timeoutMs,
        pinned?.dispatcher,
      );

      if (isRedirect(response.status)) {
        if (redirectCount === maxRedirects) {
          throw new FetchSafetyError("Redirect limit exceeded.");
        }

        const location = response.headers.get("location");
        if (!location) {
          throw new FetchSafetyError(
            "Redirect response did not include a location.",
          );
        }

        // Parse-validate now (protocol/port/localhost); DNS re-verified next hop.
        currentUrl = parseSafeHttpUrl(new URL(location, currentUrl));
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      assertTextContentType(contentType);

      const body = await readResponseBody(response, maxBytes);
      const isHtml =
        contentType.toLowerCase().includes("html") ||
        contentType.toLowerCase().includes("application/xhtml+xml");

      return {
        finalUrl: currentUrl.toString(),
        httpStatus: response.status,
        contentType,
        rawText: extractText(body, contentType),
        rawHtml: isHtml ? body : null,
        title: isHtml ? extractTitle(body) : null,
      };
    } finally {
      await pinned?.close();
    }
  }

  throw new FetchSafetyError("Unexpected redirect handling failure.");
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: URL,
  timeoutMs: number,
  dispatcher?: unknown,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // `dispatcher` is an undici option not present in the standard RequestInit
    // type; Node's fetch honours it at runtime.
    return await fetchImpl(url, {
      redirect: "manual",
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
  } finally {
    clearTimeout(timeout);
  }
}

type PinnedDispatcher = { dispatcher: unknown; close: () => Promise<void> };

/**
 * Build an undici dispatcher that pins the socket to a pre-verified public IP,
 * closing the DNS-rebinding window between our safety check and the connect.
 * TLS servername and the Host header still use the URL hostname. Returns
 * undefined when undici is unavailable (falls back to the pre-fetch check).
 */
async function createPinnedDispatcher(
  address: ResolvedAddress,
): Promise<PinnedDispatcher | undefined> {
  try {
    const undici = (await import("undici")) as unknown as {
      Agent: new (options: unknown) => { close: () => Promise<void> };
    };
    const agent = new undici.Agent({
      connect: {
        // Node/undici may call lookup in either dns.lookup form: with
        // { all: true } expecting an array, or scalar expecting (addr, family).
        lookup: (
          _hostname: string,
          options: unknown,
          callback: (err: Error | null, addr: unknown, family?: number) => void,
        ) => {
          const wantsAll =
            typeof options === "object" &&
            options !== null &&
            (options as { all?: boolean }).all === true;
          if (wantsAll) {
            callback(null, [
              { address: address.address, family: address.family },
            ]);
          } else {
            callback(null, address.address, address.family);
          }
        },
      },
    });
    return { dispatcher: agent, close: () => agent.close() };
  } catch {
    return undefined;
  }
}

function assertTextContentType(contentType: string) {
  const normalized = contentType.toLowerCase();

  if (
    normalized.includes("text/html") ||
    normalized.includes("application/xhtml+xml") ||
    normalized.includes("text/plain") ||
    normalized === ""
  ) {
    return;
  }

  throw new FetchSafetyError(`Unsupported content type: ${contentType}`);
}

async function readResponseBody(response: Response, maxBytes: number) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > maxBytes) {
      throw new FetchSafetyError("Response exceeded maximum size.");
    }

    chunks.push(value);
  }

  return new TextDecoder().decode(concatChunks(chunks, received));
}

function concatChunks(chunks: Uint8Array[], totalLength: number) {
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

export function extractTitle(body: string): string | null {
  const $ = cheerio.load(body);
  const title = $("title").first().text().trim();
  return title.length > 0 ? title.slice(0, 300) : null;
}

export function extractText(body: string, contentType: string) {
  if (!contentType.toLowerCase().includes("html")) {
    return collapseWhitespace(body);
  }

  const $ = cheerio.load(body);
  $("script, style, noscript, svg, canvas").remove();
  $(
    "br, p, div, li, h1, h2, h3, h4, h5, h6, section, article, header, footer, td, th",
  ).append(" ");

  return collapseWhitespace($("body").text() || $.root().text());
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
