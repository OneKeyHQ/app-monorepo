import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  extractGrpcWebDataFrame,
  fetchZcashChainTipDirect,
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
});
