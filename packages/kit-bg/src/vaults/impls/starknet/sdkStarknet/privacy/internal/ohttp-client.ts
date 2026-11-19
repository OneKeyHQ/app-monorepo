/**
 * OHTTP (Oblivious HTTP, RFC 9458) client for encrypting service
 * requests and decrypting responses using HPKE.
 *
 * Wraps the `ohttp-ts` library by Thibault Meunier (Cloudflare).
 */

import { OHTTPClient, KeyConfig } from "ohttp-ts";
// onekey: the HPKE suite moved behind a platform-swappable factory so Hermes can
// supply pure-JS primitives; upstream constructed it inline from `hpke` here.
import { decompressResponseText } from "../platform/decompressResponseText";
import { createHpkeSuite } from "../platform/hpkeSuiteRegistry";
import { ReorgError, ServiceHttpError } from "./errors";

/** HTTP 409 — the discovery service returns this exclusively for block reorgs (BLOCK_REORGED). */
const REORG_STATUS = 409;

// Synthetic origin for the inner OHTTP Request URL. The OHTTP gateway routes
// the decapsulated request by path only (axum does not match on Host), so the
// scheme/authority on the inner Request are inert. Using a fixed reserved-TLD
// origin (RFC 6761 `.invalid`) decouples the inner request path from whatever
// outer URL the SDK was configured with — without this, a `gatewayUrl` that
// includes a reverse-proxy path prefix (e.g. `/discovery`) leaks into the
// inner path and produces a 404 when the gateway server tries to route it.
const INNER_REQUEST_ORIGIN = "https://ohttp-target.invalid";

/** Configuration for enabling OHTTP. `true` uses defaults; an object allows custom relay/key config. */
export type OhttpOption = boolean | { relayUrl?: string; publicKeyConfig?: Uint8Array };

/**
 * OHTTP client that encrypts requests and decrypts responses.
 *
 * Fetches the server's HPKE key config from `GET /ohttp-keys`
 * and uses it to encapsulate requests as `message/ohttp-req`.
 */
export class OhttpClient {
  private ohttpClient: OHTTPClient | null = null;
  private readonly pinnedKeyConfig: Uint8Array | undefined;

  /**
   * @param gatewayUrl - URL where the OHTTP gateway accepts encapsulated requests
   *   and serves `/ohttp-keys`. May include a reverse-proxy path prefix (e.g.
   *   `https://api.example.com/discovery`); the prefix is preserved on outer
   *   requests but stripped from the inner OHTTP request path (which always
   *   uses just the supplied per-call `path`).
   *   Must be HTTPS in production — without it (or a pinned `publicKeyConfig`),
   *   an active network attacker can replace the OHTTP key config.
   * @param options.relayUrl - Optional OHTTP relay URL. When set, encapsulated
   *   requests are sent here instead of the gateway. `/ohttp-keys` is still
   *   fetched from `gatewayUrl`.
   * @param options.publicKeyConfig - Optional pinned key config bytes
   *   (`application/ohttp-keys` format). When set, `/ohttp-keys` is never fetched.
   */
  constructor(
    private readonly gatewayUrl: string,
    options?: { relayUrl?: string; publicKeyConfig?: Uint8Array }
  ) {
    this.pinnedKeyConfig = options?.publicKeyConfig;
    if (options?.relayUrl) {
      this.relayUrl = options.relayUrl;
    }
  }

  private relayUrl?: string;

  /**
   * Send an OHTTP-encapsulated GET request and return the decrypted JSON response.
   */
  async get<T>(path: string): Promise<T> {
    return this.send<T>(path, new Request(`${INNER_REQUEST_ORIGIN}${path}`, { method: "GET" }));
  }

  /**
   * Send an OHTTP-encapsulated POST request and return the decrypted JSON response.
   */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>(
      path,
      new Request(`${INNER_REQUEST_ORIGIN}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }

  private async send<T>(path: string, request: Request): Promise<T> {
    await this.ensureClient();

    const { init, context } = await this.ohttpClient!.encapsulateRequest(request);

    const targetUrl = this.relayUrl ?? this.gatewayUrl;
    const response = await fetch(targetUrl, init);

    // Pre-decryption errors come as plain HTTP responses
    if (response.status === 422) {
      this.invalidate();
      throw new Error("OHTTP decapsulation failed on server");
    }

    // Defense-in-depth: catch non-encapsulated error responses (e.g. from a relay).
    // In normal OHTTP operation, error responses are encapsulated and handled below.
    if (!response.ok && response.headers.get("content-type") !== "message/ohttp-res") {
      if (response.status === REORG_STATUS) {
        throw new ReorgError(`Block reorged during ${path}`);
      }
      throw new ServiceHttpError(`OHTTP request ${path}`, response.status, response.headers.get("Retry-After"));
    }

    // Decrypt the OHTTP response
    const innerResponse = await context.decapsulateResponse(response);

    // The reconstructed Response from decapsulateResponse does not auto-decompress
    // Content-Encoding (unlike fetch). Handle gzip/deflate explicitly.
    const innerBody = await readResponseText(innerResponse);

    // The OHTTP server encapsulates all API responses (including errors) inside the
    // envelope with outer status 200. A 409 BLOCK_REORGED from the discovery API
    // appears here as the inner HTTP status — this is the primary reorg detection path.
    if (innerResponse.status === REORG_STATUS) {
      throw new ReorgError(`Block reorged during ${path}`);
    }

    if (innerResponse.status !== 200) {
      throw new ServiceHttpError(`OHTTP inner response ${path}`, innerResponse.status, innerResponse.headers.get("Retry-After"));
    }

    return JSON.parse(innerBody) as T;
  }

  /** Fetch (or use pinned) key config and create the OHTTPClient. */
  private async ensureClient(): Promise<void> {
    if (this.ohttpClient) {
      return;
    }

    let raw: Uint8Array;
    if (this.pinnedKeyConfig) {
      raw = this.pinnedKeyConfig;
    } else {
      const response = await fetch(`${this.gatewayUrl}/ohttp-keys`);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch OHTTP key config: ${response.status} ${response.statusText}`
        );
      }
      raw = new Uint8Array(await response.arrayBuffer());
    }

    // The /ohttp-keys endpoint returns `application/ohttp-keys` list format (RFC 9458 §3.2)
    // with 2-byte length prefixes per entry. KeyConfig.parse (single) does not handle
    // length prefixes, so parseMultiple is the correct parser for this wire format.
    const publicKeyConfigs = KeyConfig.parseMultiple(raw);
    if (publicKeyConfigs.length === 0) {
      throw new Error("OHTTP key config response contained no key configurations");
    }
    const publicKeyConfig = publicKeyConfigs[0];
    // onekey: suite comes from platform/hpkeSuiteRegistry (was inline here).
    const suite = createHpkeSuite();
    this.ohttpClient = new OHTTPClient(suite, publicKeyConfig);
  }

  private invalidate(): void {
    this.ohttpClient = null;
  }
}

/** Supported Content-Encoding → DecompressionStream format mapping. */
const ENCODING_TO_FORMAT: Record<string, CompressionFormat> = {
  gzip: "gzip",
  "x-gzip": "gzip",
  deflate: "deflate",
};

/**
 * Read the body text from a Response, decompressing if Content-Encoding is set.
 * The Response objects from ohttp-ts decapsulateResponse do not auto-decompress
 * like fetch() responses do, so we handle gzip/deflate explicitly via DecompressionStream.
 */
async function readResponseText(response: Response): Promise<string> {
  const encoding = response.headers.get("content-encoding")?.toLowerCase();
  if (!encoding || encoding === "identity") {
    return response.text();
  }
  const format = ENCODING_TO_FORMAT[encoding];
  if (!format) {
    // DecompressionStream only supports gzip and deflate per the Compression Streams spec.
    // Brotli (br) and zstd are not universally available across runtimes.
    throw new Error(`Unsupported Content-Encoding in OHTTP response: ${encoding}`);
  }
  // onekey: DecompressionStream lives in a platform file; native rejects with a
  // clear error instead of failing on a missing streaming response body.
  return decompressResponseText(response, format);
}
