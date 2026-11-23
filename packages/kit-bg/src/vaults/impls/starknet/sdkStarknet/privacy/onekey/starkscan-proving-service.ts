// onekey: Starkscan hosts the mainnet STRK20 prover as a REST job queue
// (https://starkscan.co/docs/api/strk20-prover) rather than JSON-RPC
// `starknet_proveTransaction`. Same request fields and same verbatim result,
// different envelope. Plugs into ProvingServiceProofProvider via `transport`.
// The app reaches it through the OneKey wallet proxy (a `fetchImpl` with an
// empty `baseUrl`), where the backend adds the API key, so the client never
// holds one.
import { z } from 'zod';

import {
  DEFAULT_PROVE_BASE_DELAY_MS,
  DEFAULT_PROVE_MAX_RETRIES,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_PROVE_BACKOFF_MS,
  ProveTransactionResultSchema,
  ProvingServiceError,
} from '../internal/proving-service';
import { StarknetPrivacySdkPlatformError } from '../platform/errors';
import { withTimeoutSignal } from '../platform/timeoutSignal';

import { StarkscanProverError } from './starkscan-prover-error';

import type { ProofInvocation } from '../interfaces';
import type {
  ProveTransactionResult,
  ProveTransport,
  ProvingRetryOptions,
} from '../internal/proving-service';
import type { BlockIdentifier } from 'starknet';

const DEFAULT_MAX_WAIT_MS = 300_000;
const DEFAULT_POLL_AFTER_SECONDS = 5;
const MIN_POLL_AFTER_SECONDS = 1;
const MAX_POLL_AFTER_SECONDS = 30;

export { StarkscanProverError };

export type StarkscanProvingServiceOptions = {
  /** Prefix for `/prove`, e.g. `https://api.starkscan.co/v1/SN_MAIN`. */
  baseUrl: string;
  /** Per HTTP call. Default DEFAULT_REQUEST_TIMEOUT_MS. */
  requestTimeoutMs?: number;
  /** Whole job including polling and retries. Default 300_000. */
  maxWaitMs?: number;
  /** Retries for submit HTTP 503 and terminal `unavailable`. */
  retry?: ProvingRetryOptions;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  idempotencyKey?: () => string;
};

// Errors the retry loop may resubmit; kept off the public error shape.
const transientErrors = new WeakSet<StarkscanProverError>();

const JobErrorSchema = z
  .object({
    code: z.union([z.string(), z.number()]).optional(),
    source: z.string().optional(),
    message: z.string().optional(),
    data: z.unknown().optional(),
  })
  .passthrough();

const JobSchema = z
  .object({
    jobId: z.string().min(1),
    status: z.string(),
    terminal: z.boolean(),
    pollAfterSeconds: z.number().nullish(),
    result: z.unknown().optional(),
    error: JobErrorSchema.nullish(),
    resultUnavailableReason: z.string().nullish(),
  })
  .passthrough();

type IStarkscanJob = z.infer<typeof JobSchema>;

const ErrorBodySchema = z
  .object({ code: z.string().optional(), message: z.string().optional() })
  .passthrough();

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function defaultIdempotencyKey(): string {
  const cryptoImpl = globalThis.crypto;
  if (typeof cryptoImpl?.getRandomValues !== 'function') {
    throw new StarknetPrivacySdkPlatformError(
      'crypto.getRandomValues is unavailable; cannot create an idempotency key',
    );
  }
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function clampPollSeconds(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_POLL_AFTER_SECONDS;
  }
  return Math.min(
    MAX_POLL_AFTER_SECONDS,
    Math.max(MIN_POLL_AFTER_SECONDS, value),
  );
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }
  const date = Date.parse(header);
  if (Number.isNaN(date)) {
    return undefined;
  }
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/**
 * A status GET is idempotent, so a dropped connection or a 429/5xx there is
 * worth polling again. Resubmitting instead would open a second job, debit the
 * daily budget twice and lose the first job's once-only result.
 */
function isTransientPollError(error: unknown): boolean {
  if (error instanceof StarkscanProverError) {
    return (
      error.status !== undefined &&
      (error.status === 429 || error.status >= 500)
    );
  }
  // fetch rejects with TypeError on network failure, and timeoutSignal aborts
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError'))
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export class StarkscanProvingService implements ProveTransport {
  private readonly baseUrl: string;

  private readonly requestTimeoutMs: number;

  private readonly maxWaitMs: number;

  private readonly maxRetries: number;

  private readonly baseDelayMs: number;

  private readonly fetchImpl: typeof fetch;

  private readonly sleep: (ms: number) => Promise<void>;

  private readonly createIdempotencyKey: () => string;

  constructor(options: StarkscanProvingServiceOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.requestTimeoutMs =
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    this.maxRetries = options.retry?.maxRetries ?? DEFAULT_PROVE_MAX_RETRIES;
    this.baseDelayMs =
      options.retry?.baseDelayMs ?? DEFAULT_PROVE_BASE_DELAY_MS;
    // Bind so a bare global fetch is not invoked with a foreign `this`.
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? defaultSleep;
    this.createIdempotencyKey = options.idempotencyKey ?? defaultIdempotencyKey;
  }

  async proveTransaction(
    blockId: BlockIdentifier,
    transaction: ProofInvocation,
  ): Promise<ProveTransactionResult> {
    const blockIdParam =
      typeof blockId === 'number' || typeof blockId === 'bigint'
        ? { block_number: Number(blockId) }
        : blockId;
    const body = JSON.stringify({ block_id: blockIdParam, transaction });
    const idempotencyKey = this.createIdempotencyKey();
    const deadline = Date.now() + this.maxWaitMs;

    for (let attempt = 0; ; attempt += 1) {
      try {
        // oxlint-disable-next-line no-await-in-loop
        return await this.runJob(body, idempotencyKey, deadline);
      } catch (error) {
        const delayMs = Math.max(
          Math.min(this.baseDelayMs * 2 ** attempt, MAX_PROVE_BACKOFF_MS),
          error instanceof StarkscanProverError
            ? (error.retryAfterSeconds ?? 0) * 1000
            : 0,
        );
        const retryable =
          error instanceof StarkscanProverError && transientErrors.has(error);
        if (
          !retryable ||
          attempt >= this.maxRetries ||
          Date.now() + delayMs >= deadline
        ) {
          throw error;
        }
        // oxlint-disable-next-line no-await-in-loop
        await this.sleep(delayMs);
      }
    }
  }

  private async runJob(
    body: string,
    idempotencyKey: string,
    deadline: number,
  ): Promise<ProveTransactionResult> {
    let job = await this.submit(
      body,
      idempotencyKey,
      this.remainingTimeout(deadline),
    );
    let delayMs = clampPollSeconds(job.pollAfterSeconds) * 1000;
    let pollFailures = 0;
    while (!job.terminal) {
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        // oxlint-disable-next-line no-await-in-loop
        await this.sleep(Math.min(delayMs, remaining));
      }
      const timeout = this.remainingTimeout(deadline, job.jobId);
      let polled: IStarkscanJob | undefined;
      try {
        // oxlint-disable-next-line no-await-in-loop
        polled = await this.poll(job.jobId, timeout);
      } catch (error) {
        pollFailures += 1;
        if (
          error instanceof StarkscanProverError &&
          error.retryAfterSeconds !== undefined
        ) {
          delayMs = Math.max(delayMs, error.retryAfterSeconds * 1000);
        }
        if (!isTransientPollError(error) || pollFailures > this.maxRetries) {
          throw error;
        }
      }
      if (polled) {
        job = polled;
        pollFailures = 0;
        if (
          job.pollAfterSeconds !== null &&
          job.pollAfterSeconds !== undefined
        ) {
          delayMs = clampPollSeconds(job.pollAfterSeconds) * 1000;
        }
      }
    }
    this.remainingTimeout(deadline, job.jobId);
    return this.settle(job);
  }

  private remainingTimeout(deadline: number, jobId?: string): number {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new StarkscanProverError(
        'poll_timeout',
        `Starkscan prover job did not finish within ${this.maxWaitMs}ms`,
        { jobId },
      );
    return Math.min(this.requestTimeoutMs, remaining);
  }

  private async submit(
    body: string,
    idempotencyKey: string,
    timeout: number,
  ): Promise<IStarkscanJob> {
    return withTimeoutSignal(timeout, async (signal) => {
      const res = await this.fetchImpl(`${this.baseUrl}/prove`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
          'content-type': 'application/json',
          'accept': 'application/json',
        },
        body,
        signal,
      });
      return this.readJob(res);
    });
  }

  private async poll(jobId: string, timeout: number): Promise<IStarkscanJob> {
    return withTimeoutSignal(timeout, async (signal) => {
      const res = await this.fetchImpl(
        `${this.baseUrl}/prove/${encodeURIComponent(jobId)}`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
          },
          signal,
        },
      );
      return this.readJob(res, jobId);
    });
  }

  private async readJob(res: Response, jobId?: string): Promise<IStarkscanJob> {
    const json = parseJson(await res.text());
    if (!res.ok) {
      const parsed = ErrorBodySchema.safeParse(json);
      const errorBody = parsed.success ? parsed.data : {};
      const error = new StarkscanProverError(
        errorBody.code ?? `http_${res.status}`,
        errorBody.message ?? `Starkscan prover HTTP ${res.status}`,
        {
          status: res.status,
          jobId,
          retryAfterSeconds: parseRetryAfter(res.headers.get('Retry-After')),
        },
      );
      // Only a rejected submit is safe to resend; a failing GET is not.
      if (res.status === 503 && jobId === undefined) {
        transientErrors.add(error);
      }
      throw error;
    }
    const parsed = JobSchema.safeParse(json);
    if (!parsed.success) {
      throw new StarkscanProverError(
        'invalid_response',
        `Starkscan prover returned an unexpected job shape: ${parsed.error.message}`,
        { status: res.status, jobId },
      );
    }
    return parsed.data;
  }

  private settle(job: IStarkscanJob): ProveTransactionResult {
    const { jobId } = job;
    const jobError = job.error ?? undefined;
    switch (job.status) {
      case 'succeeded': {
        if (job.result === null || job.result === undefined) {
          throw new StarkscanProverError(
            'result_expired',
            `Starkscan prover result is gone (${job.resultUnavailableReason ?? 'no result'})`,
            { jobId },
          );
        }
        const parsed = ProveTransactionResultSchema.safeParse(job.result);
        if (!parsed.success) {
          throw new StarkscanProverError(
            'invalid_result',
            `Starkscan prover returned an invalid result: ${parsed.error.message}`,
            { jobId },
          );
        }
        return parsed.data;
      }
      case 'failed': {
        const message = jobError?.message ?? 'Starkscan prover job failed';
        if (
          jobError?.source === 'prover' &&
          typeof jobError.code === 'number'
        ) {
          throw new ProvingServiceError(
            jobError.code,
            message,
            typeof jobError.data === 'string' ? jobError.data : undefined,
          );
        }
        throw new StarkscanProverError(
          jobError?.code === undefined ? 'job_failed' : String(jobError.code),
          message,
          { jobId },
        );
      }
      case 'unavailable': {
        const error = new StarkscanProverError(
          typeof jobError?.code === 'string'
            ? jobError.code
            : 'prover_unavailable',
          jobError?.message ?? 'Starkscan prover job became unavailable',
          { jobId },
        );
        transientErrors.add(error);
        throw error;
      }
      case 'unknown_delivery':
        throw new StarkscanProverError(
          'prover_delivery_unknown',
          'Starkscan prover delivery state is unknown; not resubmitting',
          { jobId },
        );
      default:
        throw new StarkscanProverError(
          'invalid_response',
          `Starkscan prover job ended with unknown status "${job.status}"`,
          { jobId },
        );
    }
  }
}
