import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  extractGrpcWebDataFrame,
  fetchZcashChainTipDirect,
  fetchZcashTransactionMissingDirect,
  parseZcashBlockIdHeight,
} from './chainTipDirect';

// BlockID { height: 3_123_456, hash: 0xab 0xcd }
const HEIGHT = 3_123_456;
const BLOCK_ID_MESSAGE = Uint8Array.from([
  0x08, 0x80, 0xd2, 0xbe, 0x01, 0x12, 0x02, 0xab, 0xcd,
]);

function frame(flag: number, payload: Uint8Array) {
  const out = new Uint8Array(5 + payload.length);
  out[0] = flag;
  out[4] = payload.length;
  out.set(payload, 5);
  return out;
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

describe('chainTipDirect', () => {
  it('parses the height out of a BlockID message', () => {
    expect(parseZcashBlockIdHeight(BLOCK_ID_MESSAGE)).toBe(HEIGHT);
  });

  it('returns the data frame and skips trailers', () => {
    const trailer = frame(0x80, new TextEncoder().encode('grpc-status:0\r\n'));
    const body = concat(frame(0, BLOCK_ID_MESSAGE), trailer);
    expect(extractGrpcWebDataFrame(body)).toEqual(BLOCK_ID_MESSAGE);
    expect(extractGrpcWebDataFrame(trailer)).toBeNull();
  });

  it('fetches the tip over grpc-web and tolerates failures', async () => {
    const originalFetch = globalThis.fetch;
    const body = concat(
      frame(0, BLOCK_ID_MESSAGE),
      frame(0x80, new TextEncoder().encode('grpc-status:0\r\n')),
    );
    const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(
        'https://example.test/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock',
      );
      expect(init.method).toBe('POST');
      return {
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => body.buffer.slice(0),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      await expect(
        fetchZcashChainTipDirect({ lightwalletdUrl: 'https://example.test/' }),
      ).resolves.toBe(HEIGHT);

      globalThis.fetch = jest.fn(() =>
        Promise.reject(new OneKeyLocalError('offline')),
      ) as unknown as typeof fetch;
      await expect(
        fetchZcashChainTipDirect({ lightwalletdUrl: 'https://example.test' }),
      ).resolves.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not accept a height followed by an error or malformed grpc trailer', async () => {
    const originalFetch = globalThis.fetch;
    try {
      for (const trailer of [
        frame(0x80, new TextEncoder().encode('grpc-status:14\r\n')),
        new Uint8Array([0x80, 0, 0, 0, 20, 1]),
      ]) {
        globalThis.fetch = jest.fn(
          async () => new Response(concat(frame(0, BLOCK_ID_MESSAGE), trailer)),
        ) as typeof fetch;
        // eslint-disable-next-line no-await-in-loop
        await expect(
          fetchZcashChainTipDirect({ lightwalletdUrl: 'https://example.test' }),
        ).resolves.toBeNull();
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('expired transaction absence evidence', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it.each(['5', '0', '14'])(
    'requires explicit NOT_FOUND, status %s',
    async (status) => {
      const trailer = frame(
        0x80,
        new TextEncoder().encode(`grpc-status:${status}\r\n`),
      );
      globalThis.fetch = jest.fn(async (_url: string, init: RequestInit) => {
        const request = new Uint8Array(init.body as Uint8Array);
        expect([...request.subarray(5, 7)]).toEqual([0x1a, 32]);
        expect(request[7]).toBe(0x22);
        expect(request[38]).toBe(0x11);
        return {
          ok: true,
          headers: { get: () => null },
          arrayBuffer: async () => trailer.buffer,
        } as unknown as Response;
      }) as unknown as typeof fetch;
      await expect(
        fetchZcashTransactionMissingDirect({
          lightwalletdUrl: 'https://example.test',
          txid: `11${'00'.repeat(30)}22`,
        }),
      ).resolves.toBe(status === '5');
    },
  );

  it('does not infer absence from a timeout or malformed response', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new OneKeyLocalError('timeout');
    }) as unknown as typeof fetch;
    const params = {
      lightwalletdUrl: 'https://example.test',
      txid: 'aa'.repeat(32),
    };
    await expect(fetchZcashTransactionMissingDirect(params)).resolves.toBe(
      false,
    );
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: async () => new Uint8Array([0x80]).buffer,
    })) as unknown as typeof fetch;
    await expect(fetchZcashTransactionMissingDirect(params)).resolves.toBe(
      false,
    );
  });
});
