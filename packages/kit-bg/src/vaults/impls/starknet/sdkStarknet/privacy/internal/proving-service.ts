/**
 * Standalone JSON-RPC client for the proving service (starknet_proveTransaction, etc.).
 * Structured similarly to starknet's RpcProvider.
 */

import type { BlockIdentifier } from "starknet";
import type { ProofInvocation } from "../interfaces";
import { z } from "zod";
// onekey: AbortSignal.timeout is absent on Hermes and older WebViews.
import { withTimeoutSignal } from "../platform/timeoutSignal";
import type { OhttpClient } from "./ohttp-client";

/** Default request timeout: 30s (proofs typically take a few seconds). */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Default number of retries after the initial attempt on a transient prove failure. */
export const DEFAULT_PROVE_MAX_RETRIES = 3;
/** Default base delay (ms) for exponential backoff between prove retries. */
export const DEFAULT_PROVE_BASE_DELAY_MS = 1_000;
/**
 * Upper bound on a single backoff delay. Caps `baseDelayMs * 2^attempt` so a large
 * caller-supplied `maxRetries` can't schedule an unbounded (days-long) sleep.
 */
export const MAX_PROVE_BACKOFF_MS = 30_000;

/** JSON-RPC error code the prover returns when it is temporarily overloaded ("retry later"). */
const SERVICE_BUSY_CODE = -32005;

/** HTTP status codes treated as transient (worth retrying) on the plain-fetch transport. */
const TRANSIENT_HTTP_STATUS = new Set([503]);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Structured error from the proving service JSON-RPC endpoint.
 *
 * The `code` field is a numeric JSON-RPC error code that callers can switch on:
 *
 * **Prover codes (Starknet RPC v0.10):**
 * - `24`    — Block not found
 * - `55`    — Account validation failed
 * - `61`    — Unsupported transaction version
 * - `1000`  — Invalid transaction input
 * - `-32005` — Service busy (retry later)
 * - `-32603` — Internal prover error
 *
 * **Proxy interceptor codes (1xxxx range):**
 * - `10000` — Transaction rejected (e.g. screening/compliance)
 */
export class ProvingServiceError extends Error {
  override readonly name = "ProvingServiceError";

  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: string
  ) {
    super(data ? `${message}: ${data}` : message);
  }
}

/**
 * Error thrown when the proving service responds with a non-2xx HTTP status on
 * the plain-fetch transport. `status` lets callers (and the retry policy) branch
 * on the HTTP status; 503 (service unavailable) is treated as transient and retried.
 */
export class ProvingServiceHttpError extends Error {
  override readonly name = "ProvingServiceHttpError";

  constructor(
    public readonly status: number,
    body: string
  ) {
    super(`Proving service HTTP ${status}: ${body}`);
  }
}

/**
 * Retry policy for transient proving-service failures — the prover returning
 * service-busy (`-32005`) or HTTP 503. Non-transient errors (invalid tx,
 * screening rejection, network failure) are never retried and surface immediately.
 *
 * Applies only to `proveTransaction`; `getSpecVersion`/`isHealthy` never retry so
 * health checks stay fast.
 *
 * Transport note: the service-busy `-32005` code is a JSON-RPC body error and is
 * retried on both the plain-fetch and OHTTP transports. The HTTP 503 case is only
 * retried on plain fetch — over OHTTP a 503 surfaces as a generic error from the
 * OHTTP layer (no status), so it is not classified as transient.
 */
export interface ProvingRetryOptions {
  /**
   * Maximum retries after the initial attempt. `0` disables retries (fail on the
   * first transient error). Default {@link DEFAULT_PROVE_MAX_RETRIES}.
   */
  maxRetries?: number;
  /**
   * Base delay in ms for exponential backoff: the wait before retry `attempt`
   * (0-indexed) is `baseDelayMs * 2^attempt` — e.g. 1s, 2s, 4s with the default.
   * Default {@link DEFAULT_PROVE_BASE_DELAY_MS}.
   */
  baseDelayMs?: number;
}

// TODO: Support "latest-verifiable" and { blocksBack: number } server-side; then accept them here and pass through.
// Current server only supports block_id: "latest" | { block_number: N } | { block_hash: "0x..." }.

export interface ProvingServiceConfig {
  baseUrl: string;
  /** Request timeout in ms. Default 30_000 (30 seconds). */
  requestTimeoutMs?: number;
  /** When set, requests are encrypted via OHTTP instead of plain fetch. */
  ohttpClient?: OhttpClient;
  /**
   * Retry policy for transient (service-busy / HTTP 503) failures on
   * `proveTransaction`. Defaults to {@link DEFAULT_PROVE_MAX_RETRIES} retries
   * with {@link DEFAULT_PROVE_BASE_DELAY_MS} base backoff.
   */
  retry?: ProvingRetryOptions;
}

/** Result of starknet_proveTransaction. */
export interface ProveTransactionResult {
  /** Proof data: base64-encoded binary from the proving service. */
  proof: string;
  proof_facts: string[];
  l2_to_l1_messages: MessageToL1[];
  /**
   * Optional typed side-channel the prover attaches alongside the proof.
   * For screened deposits it carries the screening signature; absent for
   * transactions that need no attestation. Forward-compatible: new capabilities
   * add sibling keys without breaking existing consumers.
   */
  additional_data?: AdditionalData;
}

export interface MessageToL1 {
  from_address: string;
  to_address: string;
  payload: string[];
}

/**
 * Screening attestation produced by the FPI cloud function and relayed by the
 * proof interceptor / prover. The contract verifies it against the proven
 * deposit's `from_addr`.
 *
 * Felts are 0x-hex strings on the wire; `issued_at` is unix seconds.
 */
export interface ScreeningSignature {
  issued_at: number;
  sig_r: string;
  sig_s: string;
}

/** Typed `additional_data` side-channel on a prove response. */
export interface AdditionalData {
  signature?: ScreeningSignature;
}

const MessageToL1Schema = z
  .object({
    from_address: z.string(),
    to_address: z.string(),
    payload: z.array(z.string()),
  })
  .strict();

const ScreeningSignatureSchema = z
  .object({
    issued_at: z.number(),
    sig_r: z.string(),
    sig_s: z.string(),
  })
  .strict();

const AdditionalDataSchema = z
  .object({
    signature: ScreeningSignatureSchema.optional(),
  })
  .strict();

// onekey: exported so alternative transports (src/onekey/) validate results identically.
export const ProveTransactionResultSchema = z
  .object({
    proof: z.string().min(1),
    proof_facts: z.array(z.string()),
    l2_to_l1_messages: z.array(MessageToL1Schema),
    additional_data: AdditionalDataSchema.optional(),
  })
  .strict();

// onekey: transport seam so ProvingServiceProofProvider can use a non-JSON-RPC prover.
export interface ProveTransport {
  proveTransaction(
    blockId: BlockIdentifier,
    transaction: ProofInvocation
  ): Promise<ProveTransactionResult>;
}

export class ProvingService {
  private baseUrl: string;
  private requestTimeoutMs: number;
  private ohttpClient?: OhttpClient;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(config: ProvingServiceConfig) {
    this.baseUrl = config.baseUrl;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.ohttpClient = config.ohttpClient;
    this.maxRetries = config.retry?.maxRetries ?? DEFAULT_PROVE_MAX_RETRIES;
    this.baseDelayMs = config.retry?.baseDelayMs ?? DEFAULT_PROVE_BASE_DELAY_MS;
  }

  /**
   * Single JSON-RPC call attempt (no retry). On a non-2xx HTTP response throws
   * {@link ProvingServiceHttpError}; on a JSON-RPC error body throws
   * {@link ProvingServiceError}.
   */
  private async callOnce<T>(method: string, params: unknown): Promise<T> {
    const body = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };

    type JsonRpcResponse = {
      jsonrpc: string;
      id: number;
      result?: T;
      error?: { code: number; message: string; data?: string };
    };

    let json: JsonRpcResponse;

    if (this.ohttpClient) {
      json = await withTimeoutSignal(this.requestTimeoutMs, (signal) =>
        this.ohttpClient!.post<JsonRpcResponse>("", body, signal),
      );
    } else {
      json = await withTimeoutSignal(this.requestTimeoutMs, async (signal) => {
        const res = await fetch(this.baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          // Per-attempt timeout: each retry gets a fresh budget, so worst-case wall
          // time on a hung connection is (maxRetries + 1) * requestTimeoutMs plus backoff.
          signal,
        });

        const text = await res.text();
        if (!res.ok) {
          throw new ProvingServiceHttpError(res.status, text);
        }

        return JSON.parse(text) as JsonRpcResponse;
      });
    }

    if (json.error) {
      const { code, message, data } = json.error;
      throw new ProvingServiceError(code, message, typeof data === "string" ? data : undefined);
    }

    const result = json.result;
    if (result === undefined) {
      throw new Error("Proving service returned no result");
    }

    return result;
  }

  /**
   * JSON-RPC call that retries transient failures (service-busy `-32005` or HTTP
   * 503) with exponential backoff per the configured {@link ProvingRetryOptions}.
   * Non-transient errors are rethrown on the first attempt.
   */
  private async callWithRetry<T>(method: string, params: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.callOnce<T>(method, params);
      } catch (error) {
        if (attempt >= this.maxRetries || !isTransientError(error)) {
          throw error;
        }
        await sleep(Math.min(this.baseDelayMs * 2 ** attempt, MAX_PROVE_BACKOFF_MS));
      }
    }
  }

  async getSpecVersion(): Promise<string> {
    return this.callOnce<string>("starknet_specVersion", []);
  }

  async proveTransaction(
    blockId: BlockIdentifier,
    transaction: ProofInvocation
  ): Promise<ProveTransactionResult> {
    const blockIdParam =
      typeof blockId === "number" || typeof blockId === "bigint"
        ? { block_number: Number(blockId) }
        : blockId;
    const result = await this.callWithRetry<ProveTransactionResult>("starknet_proveTransaction", {
      block_id: blockIdParam,
      transaction,
    });
    const parsed = ProveTransactionResultSchema.safeParse(result);
    if (!parsed.success) {
      const snippet =
        typeof result === "object" && result !== null
          ? JSON.stringify(result).slice(0, 500)
          : String(result);
      throw new Error(
        `Proving service returned invalid result: expected { proof, proof_facts, l2_to_l1_messages }. ${parsed.error.message} Response: ${snippet}`
      );
    }
    return parsed.data;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.getSpecVersion();
      return true;
    } catch {
      return false;
    }
  }
}

/** Whether an error from a single prove attempt is transient and worth retrying. */
function isTransientError(error: unknown): boolean {
  if (error instanceof ProvingServiceError) {
    return error.code === SERVICE_BUSY_CODE;
  }
  if (error instanceof ProvingServiceHttpError) {
    return TRANSIENT_HTTP_STATUS.has(error.status);
  }
  return false;
}
