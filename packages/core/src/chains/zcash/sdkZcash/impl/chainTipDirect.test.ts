// cspell:ignore lightd taddr
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  extractGrpcWebDataFrame,
  fetchZcashChainTipDirect,
  fetchZcashLightdInfoDirect,
  parseZcashBlockIdHeight,
  parseZcashLightdInfoChainName,
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

describe('lightd info chain name', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stringField(field: number, value: string) {
    const bytes = new TextEncoder().encode(value);
    return Uint8Array.from([field * 8 + 2, bytes.length, ...bytes]);
  }

  // LightdInfo { version, vendor, taddrSupport, chainName, saplingActivationHeight, blockHeight }
  function lightdInfo(chainName: string) {
    return concat(
      stringField(1, 'v0.4.17'),
      stringField(2, 'ECC LightWalletD'),
      Uint8Array.from([0x18, 0x01]),
      stringField(4, chainName),
      Uint8Array.from([0x28, 0x80, 0xcb, 0x19]),
      Uint8Array.from([0x38, 0x80, 0xd2, 0xbe, 0x01]),
    );
  }

  it('parses chainName after other fields', () => {
    expect(parseZcashLightdInfoChainName(lightdInfo('main'))).toBe('main');
    expect(parseZcashLightdInfoChainName(lightdInfo('test'))).toBe('test');
  });

  it('returns null when chainName is absent or truncated', () => {
    expect(parseZcashLightdInfoChainName(stringField(1, 'v0.4.17'))).toBe(null);
    expect(
      parseZcashLightdInfoChainName(Uint8Array.from([0x22, 0x04, 0x6d])),
    ).toBeNull();
  });

  it('fetches GetLightdInfo and tolerates failures', async () => {
    const body = concat(
      frame(0, lightdInfo('main')),
      frame(0x80, new TextEncoder().encode('grpc-status:0\r\n')),
    );
    globalThis.fetch = jest.fn(async (url: string) => {
      expect(url).toBe(
        'https://example.test/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLightdInfo',
      );
      return {
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => body.buffer.slice(0),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    await expect(
      fetchZcashLightdInfoDirect({ lightwalletdUrl: 'https://example.test/' }),
    ).resolves.toEqual({ chainName: 'main' });

    globalThis.fetch = jest.fn(() =>
      Promise.reject(new OneKeyLocalError('offline')),
    ) as unknown as typeof fetch;
    await expect(
      fetchZcashLightdInfoDirect({ lightwalletdUrl: 'https://example.test' }),
    ).resolves.toBeNull();

    globalThis.fetch = jest.fn(
      async () =>
        new Response(
          frame(0x80, new TextEncoder().encode('grpc-status:12\r\n')),
        ),
    ) as typeof fetch;
    await expect(
      fetchZcashLightdInfoDirect({ lightwalletdUrl: 'https://example.test' }),
    ).resolves.toBeNull();
  });
});
