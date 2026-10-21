// Starkscan REST prover transport: envelope, polling, retry and error mapping.
// `ohttp-ts` and `hpke` are mocked virtually (same as sdkEntry.test.ts) so the
// entry can be imported before `yarn install` materializes them.

import {
  ProvingServiceError,
  ProvingServiceProofProvider,
  StarkscanProverError,
  StarkscanProvingService,
} from '.';

import { constants } from 'starknet';

import type {
  ProofInvocation,
  ProveTransactionResult,
  ProveTransport,
  StarkscanProvingServiceOptions,
} from '.';

jest.mock(
  'ohttp-ts',
  () => ({
    OHTTPClient: function MockOHTTPClient() {
      return {};
    },
    KeyConfig: { parseMultiple: () => [] },
  }),
  { virtual: true },
);

jest.mock(
  'hpke',
  () => ({
    CipherSuite: class MockCipherSuite {},
    KEM_DHKEM_X25519_HKDF_SHA256: () => ({}),
    KDF_HKDF_SHA256: () => ({}),
    AEAD_AES_128_GCM: () => ({}),
  }),
  { virtual: true },
);

const BASE_URL = 'https://api.starkscan.co/v1/SN_MAIN';
const API_KEY = 'test-api-key';
const IDEMPOTENCY_KEY = 'fixed-idempotency-key-0001';
const POOL = '0x1234';

const transaction = {
  type: 'INVOKE',
  version: '0x3',
  sender_address: POOL,
  calldata: ['0x1'],
} as unknown as ProofInvocation;

const proverResult: ProveTransactionResult = {
  proof: 'AAEC',
  proof_facts: ['0xfa', '0xfb'],
  l2_to_l1_messages: [
    { from_address: POOL, to_address: '0x0', payload: ['0xc1', '0xa1'] },
  ],
  additional_data: { signature: { issued_at: 1, sig_r: '0x1', sig_s: '0x2' } },
};

type IFetchCall = { url: string; init: RequestInit | undefined };

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function job(fields: Record<string, unknown>): Record<string, unknown> {
  return {
    jobId: 'job-1',
    attemptCount: 1,
    createdAt: '2026-10-15T00:00:00Z',
    ...fields,
  };
}

const queued = (fields: Record<string, unknown> = {}) =>
  job({ status: 'queued', terminal: false, ...fields });

const succeeded = (result: unknown = proverResult) =>
  job({ status: 'succeeded', terminal: true, result, error: null });

function createHarness(
  responses: Array<Response | (() => Response)>,
  overrides: Partial<StarkscanProvingServiceOptions> = {},
) {
  const calls: IFetchCall[] = [];
  const sleeps: number[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input as string), init });
    const next = responses.shift();
    if (!next) {
      throw new TypeError(`unexpected fetch #${calls.length}`);
    }
    return typeof next === 'function' ? next() : next;
  };
  const service = new StarkscanProvingService({
    baseUrl: `${BASE_URL}/`,
    apiKey: API_KEY,
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    idempotencyKey: () => IDEMPOTENCY_KEY,
    ...overrides,
  });
  return { service, calls, sleeps };
}

function header(call: IFetchCall, name: string): string | null {
  return new Headers(call.init?.headers).get(name);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new TypeError('expected the promise to reject');
}

describe('StarkscanProvingService', () => {
  it('submits, polls until terminal and returns the validated result', async () => {
    const { service, calls, sleeps } = createHarness([
      json(202, queued({ pollAfterSeconds: 2, queuePosition: 3 })),
      json(200, job({ status: 'dispatched', terminal: false })),
      json(200, succeeded()),
    ]);

    await expect(service.proveTransaction(123n, transaction)).resolves.toEqual(
      proverResult,
    );

    expect(calls).toHaveLength(3);
    const [submit, poll] = calls;
    expect(submit.url).toBe(`${BASE_URL}/prove`);
    expect(submit.init?.method).toBe('POST');
    expect(header(submit, 'X-Starkscan-Api-Key')).toBe(API_KEY);
    expect(header(submit, 'Idempotency-Key')).toBe(IDEMPOTENCY_KEY);
    expect(header(submit, 'content-type')).toBe('application/json');
    expect(JSON.parse(String(submit.init?.body))).toEqual({
      block_id: { block_number: 123 },
      transaction,
    });
    expect(submit.init?.signal).toBeDefined();

    expect(poll.url).toBe(`${BASE_URL}/prove/job-1`);
    expect(poll.init?.method).toBe('GET');
    expect(poll.init?.body).toBeUndefined();
    expect(header(poll, 'X-Starkscan-Api-Key')).toBe(API_KEY);
    expect(calls[2].url).toBe(`${BASE_URL}/prove/job-1`);
    expect(sleeps).toEqual([2000, 2000]);
  });

  it('passes string block ids through unchanged', async () => {
    const { service, calls } = createHarness([json(200, succeeded())]);

    await service.proveTransaction('latest', transaction);

    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      block_id: 'latest',
      transaction,
    });
  });

  it('accepts a 200 replay of the same key without polling', async () => {
    const { service, calls, sleeps } = createHarness([json(200, succeeded())]);

    await expect(service.proveTransaction(7, transaction)).resolves.toEqual(
      proverResult,
    );
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('maps a numeric prover failure to ProvingServiceError', async () => {
    const { service, calls } = createHarness([
      json(202, queued({ pollAfterSeconds: 1 })),
      json(
        200,
        job({
          status: 'failed',
          terminal: true,
          error: {
            code: 55,
            source: 'prover',
            message: 'Account validation failed',
            data: 'bad signature',
          },
        }),
      ),
    ]);

    const error = await rejection(service.proveTransaction(1, transaction));

    expect(error).toBeInstanceOf(ProvingServiceError);
    expect(error).toMatchObject({
      name: 'ProvingServiceError',
      code: 55,
      data: 'bad signature',
    });
    expect(calls).toHaveLength(2);
  });

  it('maps a non-numeric failure to StarkscanProverError', async () => {
    const { service } = createHarness([
      json(
        200,
        job({
          status: 'failed',
          terminal: true,
          error: { code: 'dispatch_rejected', source: 'starkscan' },
        }),
      ),
    ]);

    const error = await rejection(service.proveTransaction(1, transaction));

    expect(error).toBeInstanceOf(StarkscanProverError);
    expect(error).toMatchObject({
      name: 'StarkscanProverError',
      code: 'dispatch_rejected',
      jobId: 'job-1',
    });
  });

  it('retries a submit 503 with the same idempotency key', async () => {
    const { service, calls, sleeps } = createHarness(
      [
        json(503, { code: 'prover_queue_full', message: 'Queue full' }),
        json(202, queued()),
        json(200, succeeded()),
      ],
      { idempotencyKey: undefined },
    );

    await expect(service.proveTransaction(1, transaction)).resolves.toEqual(
      proverResult,
    );

    const submits = calls.filter((c) => c.init?.method === 'POST');
    expect(submits).toHaveLength(2);
    const key = header(submits[0], 'Idempotency-Key');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(header(submits[1], 'Idempotency-Key')).toBe(key);
    // Backoff 1s, then the default 5s poll interval.
    expect(sleeps).toEqual([1000, 5000]);
  });

  it('uses a fresh idempotency key per proveTransaction call', async () => {
    const { service, calls } = createHarness(
      [json(200, succeeded()), json(200, succeeded())],
      { idempotencyKey: undefined },
    );

    await service.proveTransaction(1, transaction);
    await service.proveTransaction(1, transaction);

    expect(header(calls[0], 'Idempotency-Key')).not.toBe(
      header(calls[1], 'Idempotency-Key'),
    );
  });

  it('surfaces the 503 once retries are exhausted', async () => {
    const { service, calls, sleeps } = createHarness(
      [
        json(503, { code: 'prover_unavailable' }),
        json(503, { code: 'prover_unavailable' }),
      ],
      { retry: { maxRetries: 1, baseDelayMs: 250 } },
    );

    const error = await rejection(service.proveTransaction(1, transaction));

    expect(error).toMatchObject({ code: 'prover_unavailable', status: 503 });
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([250]);
  });

  it('resubmits with the same key after a terminal unavailable', async () => {
    const { service, calls, sleeps } = createHarness([
      json(202, queued({ pollAfterSeconds: 1 })),
      json(200, job({ status: 'unavailable', terminal: true })),
      json(200, queued({ attemptCount: 2, pollAfterSeconds: 1 })),
      json(200, succeeded()),
    ]);

    await expect(service.proveTransaction(1, transaction)).resolves.toEqual(
      proverResult,
    );

    expect(calls.map((c) => c.init?.method)).toEqual([
      'POST',
      'GET',
      'POST',
      'GET',
    ]);
    expect(header(calls[2], 'Idempotency-Key')).toBe(IDEMPOTENCY_KEY);
    expect(sleeps).toEqual([1000, 1000, 1000]);
  });

  it('does not resubmit an unknown_delivery job', async () => {
    const { service, calls } = createHarness([
      json(202, queued({ pollAfterSeconds: 1 })),
      json(200, job({ status: 'unknown_delivery', terminal: true })),
    ]);

    const error = await rejection(service.proveTransaction(1, transaction));

    expect(error).toMatchObject({
      code: 'prover_delivery_unknown',
      jobId: 'job-1',
    });
    expect(calls).toHaveLength(2);
  });

  it('does not retry a 429 and parses Retry-After', async () => {
    const { service, calls, sleeps } = createHarness([
      json(
        429,
        {
          code: 'prover_daily_budget_exhausted',
          message: 'Budget exhausted',
        },
        { 'Retry-After': '3600' },
      ),
    ]);

    const error = await rejection(service.proveTransaction(1, transaction));

    expect(error).toBeInstanceOf(StarkscanProverError);
    expect(error).toMatchObject({
      code: 'prover_daily_budget_exhausted',
      status: 429,
      retryAfterSeconds: 3600,
      message: 'Budget exhausted',
    });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('maps 401 to code unauthorized without leaking the API key', async () => {
    const { service, calls } = createHarness([
      json(401, {
        code: 'unauthorized',
        message: 'Unauthorized',
        docSlug: 'api/auth',
        requestId: 'req-1',
      }),
    ]);

    const error = await rejection(service.proveTransaction(1, transaction));

    expect(error).toMatchObject({ code: 'unauthorized', status: 401 });
    expect(String((error as Error).message)).not.toContain(API_KEY);
    expect(calls).toHaveLength(1);
  });

  it('falls back to http_<status> for a non-JSON error body', async () => {
    const { service, calls } = createHarness([
      new Response('<html>bad gateway</html>', { status: 502 }),
    ]);

    const error = await rejection(service.proveTransaction(1, transaction));

    expect(error).toMatchObject({ code: 'http_502', status: 502 });
    expect(calls).toHaveLength(1);
  });

  it('keeps polling the same job through a network error and a 503', async () => {
    const { service, calls } = createHarness([
      json(202, queued({ pollAfterSeconds: 1 })),
      () => {
        throw new TypeError('Network request failed');
      },
      json(503, { code: 'service_unavailable' }),
      json(200, succeeded()),
    ]);

    await expect(service.proveTransaction(1, transaction)).resolves.toEqual(
      proverResult,
    );
    expect(calls.map((c) => c.init?.method)).toEqual([
      'POST',
      'GET',
      'GET',
      'GET',
    ]);
    expect(new Set(calls.slice(1).map((c) => c.url))).toEqual(
      new Set([`${BASE_URL}/prove/job-1`]),
    );
  });

  it('gives up polling after maxRetries consecutive transient failures', async () => {
    const { service, calls } = createHarness(
      [
        json(202, queued({ pollAfterSeconds: 1 })),
        json(502, {}),
        json(502, {}),
        json(502, {}),
      ],
      { retry: { maxRetries: 2 } },
    );

    const error = await rejection(service.proveTransaction(1, transaction));
    expect(error).toBeInstanceOf(StarkscanProverError);
    expect((error as StarkscanProverError).status).toBe(502);
    expect((error as StarkscanProverError).jobId).toBe('job-1');
    expect(calls.filter((c) => c.init?.method === 'POST')).toHaveLength(1);
  });

  it('does not retry a non-transient poll failure', async () => {
    const { service, calls } = createHarness([
      json(202, queued({ pollAfterSeconds: 1 })),
      json(404, { code: 'not_found' }),
    ]);

    const error = await rejection(service.proveTransaction(1, transaction));
    expect((error as StarkscanProverError).code).toBe('not_found');
    expect(calls).toHaveLength(2);
  });

  it('honors and clamps pollAfterSeconds', async () => {
    const { service, sleeps } = createHarness([
      json(202, queued({ pollAfterSeconds: 0 })),
      json(200, queued({ pollAfterSeconds: 120 })),
      json(200, queued({ pollAfterSeconds: 7 })),
      json(200, succeeded()),
    ]);

    await service.proveTransaction(1, transaction);

    expect(sleeps).toEqual([1000, 30_000, 7000]);
  });

  it('times out with poll_timeout once maxWaitMs is exceeded', async () => {
    let now = 1_000_000;
    const waited: number[] = [];
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const { service, calls } = createHarness(
        [
          json(202, queued({ pollAfterSeconds: 4 })),
          () => json(200, queued()),
          () => json(200, queued()),
          () => json(200, queued()),
        ],
        {
          maxWaitMs: 10_000,
          sleep: async (ms) => {
            waited.push(ms);
            now += ms;
          },
        },
      );

      const error = await rejection(service.proveTransaction(1, transaction));

      expect(error).toMatchObject({ code: 'poll_timeout', jobId: 'job-1' });
      expect(waited).toEqual([4000, 4000, 2000]);
      expect(calls).toHaveLength(4);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('rejects an invalid prover result with invalid_result', async () => {
    const { service } = createHarness([
      json(200, succeeded({ ...proverResult, proof: '' })),
    ]);

    await expect(
      service.proveTransaction(1, transaction),
    ).rejects.toMatchObject({ code: 'invalid_result', jobId: 'job-1' });
  });

  it('reports result_expired when the result was already delivered', async () => {
    const { service } = createHarness([
      json(
        200,
        job({
          status: 'succeeded',
          terminal: true,
          result: null,
          resultUnavailableReason: 'delivered_or_expired',
        }),
      ),
    ]);

    await expect(
      service.proveTransaction(1, transaction),
    ).rejects.toMatchObject({ code: 'result_expired' });
  });

  it('rejects a malformed job envelope with invalid_response', async () => {
    const { service } = createHarness([json(202, { status: 'queued' })]);

    await expect(
      service.proveTransaction(1, transaction),
    ).rejects.toMatchObject({ code: 'invalid_response', status: 202 });
  });
});

describe('ProvingServiceProofProvider with an injected transport', () => {
  it('returns a Proof from the transport without touching the network', async () => {
    const originalFetch = globalThis.fetch;
    const networkCalls: unknown[] = [];
    globalThis.fetch = async (input) => {
      networkCalls.push(input);
      throw new TypeError('network is disabled in this test');
    };
    const seen: unknown[] = [];
    const transport: ProveTransport = {
      proveTransaction: async (blockId, tx) => {
        seen.push(blockId, tx);
        return proverResult;
      },
    };
    try {
      const provider = new ProvingServiceProofProvider(
        '',
        constants.StarknetChainId.SN_MAIN,
        { transport, ohttp: true, blockIdentifier: 42 },
      );

      await expect(provider.prove(transaction)).resolves.toEqual({
        data: proverResult.proof,
        output: ['0xc1', '0xa1'],
        proofFacts: proverResult.proof_facts,
        additionalData: proverResult.additional_data,
      });
      expect(seen).toEqual([42, transaction]);
      expect(networkCalls).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
