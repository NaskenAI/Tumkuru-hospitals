import * as cheerio from "cheerio";

import {
  assertSafeHttpUrl,
  defaultResolveHostname,
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
  rawText: string;
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

  let currentUrl = await assertSafeHttpUrl(input, resolveHostname);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertSafeHttpUrl(currentUrl, resolveHostname);

    const response = await fetchWithTimeout(fetchImpl, currentUrl, timeoutMs);

    if (isRedirect(response.status)) {
      if (redirectCount === maxRedirects) {
        throw new FetchSafetyError("Redirect limit exceeded.");
      }

      const location = response.headers.get("location");
      if (!location) {
        throw new FetchSafetyError("Redirect response did not include a location.");
      }

      currentUrl = await assertSafeHttpUrl(
        new URL(location, currentUrl),
        resolveHostname,
      );
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    assertTextContentType(contentType);

    const body = await readResponseBody(response, maxBytes);

    return {
      finalUrl: currentUrl.toString(),
      httpStatus: response.status,
      contentType,
      rawText: extractText(body, contentType),
    };
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
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
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
