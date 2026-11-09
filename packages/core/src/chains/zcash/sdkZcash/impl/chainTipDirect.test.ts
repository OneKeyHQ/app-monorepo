// cspell:ignore lightd taddr
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  extractGrpcWebDataFrame,
  fetchZcashBlockTimeDirect,
  fetchZcashChainTipDirect,
  fetchZcashLightdInfoDirect,
  findZcashHeightAtTimeDirect,
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

  // An unread reply body holds a desktop host stream until it is cancelled.
  it.each([
    ['an HTTP error', new Response('bad gateway', { status: 502 })],
    [
      'a grpc error status',
      new Response('', { headers: { 'grpc-status': '14' } }),
    ],
  ])('releases the request after %s', async (_label, response) => {
    const originalFetch = globalThis.fetch;
    let signal: AbortSignal | null | undefined;
    try {
      globalThis.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
        signal = init?.signal;
        return response;
      }) as typeof fetch;
      await expect(
        fetchZcashChainTipDirect({ lightwalletdUrl: 'https://example.test' }),
      ).resolves.toBeNull();
      expect(signal?.aborted).toBe(true);
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

describe('block time lookups', () => {
  const LOW = 3_428_143;
  const HIGH = LOW + 200_000;
  const T0 = 1_785_196_800;
  // Uneven gaps (15s to 135s), still increasing, as real block times are.
  const blockTime = (height: number) =>
    T0 + 75 * (height - LOW) + Math.floor(30 * Math.sin(height));

  function varintAt(bytes: Uint8Array, offset: number) {
    let value = 0;
    let shift = 0;
    for (let i = offset; i < bytes.length; i += 1) {
      value += (bytes[i] % 128) * 2 ** shift;
      if (bytes[i] < 128) return value;
      shift += 7;
    }
    return value;
  }

  function encodeVarint(value: number) {
    const bytes: number[] = [];
    let rest = value;
    while (rest >= 128) {
      bytes.push((rest % 128) + 128);
      rest = Math.floor(rest / 128);
    }
    bytes.push(rest);
    return bytes;
  }

  // Serves GetBlock for the requested height; `fail` makes the node refuse.
  function mockNode(fail = false) {
    const requested: number[] = [];
    const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(
        'https://example.test/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetBlock',
      );
      if (fail) throw new OneKeyLocalError('offline');
      const body = init.body as Uint8Array;
      // 5-byte frame header, then BlockID { 0x08 height }.
      expect(body[5]).toBe(0x08);
      const height = varintAt(body, 6);
      requested.push(height);
      const block = Uint8Array.from([
        0x10,
        ...encodeVarint(height),
        0x28,
        ...encodeVarint(blockTime(height)),
      ]);
      const reply = concat(
        frame(0, block),
        frame(0x80, new TextEncoder().encode('grpc-status:0\r\n')),
      );
      return {
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => reply.buffer.slice(0),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return requested;
  }

  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reads a block time by height', async () => {
    const requested = mockNode();
    await expect(
      fetchZcashBlockTimeDirect({
        lightwalletdUrl: 'https://example.test',
        height: LOW + 10,
      }),
    ).resolves.toBe(blockTime(LOW + 10));
    expect(requested).toEqual([LOW + 10]);
  });

  it.each([1234, 100_000, 199_998])(
    'finds the last block at or before a time (%s blocks in)',
    async (offset) => {
      const requested = mockNode();
      const target = blockTime(LOW + offset) + 10;
      let expected = LOW;
      for (let height = LOW; height <= HIGH; height += 1) {
        if (blockTime(height) <= target) expected = height;
      }
      await expect(
        findZcashHeightAtTimeDirect({
          lightwalletdUrl: 'https://example.test',
          timeSeconds: target,
          lowHeight: LOW,
          highHeight: HIGH,
        }),
      ).resolves.toBe(expected);
      expect(requested.length).toBeLessThanOrEqual(40);
    },
  );

  it('keeps a time outside the range at its edge', async () => {
    mockNode();
    await expect(
      findZcashHeightAtTimeDirect({
        lightwalletdUrl: 'https://example.test',
        timeSeconds: T0 - 86_400,
        lowHeight: LOW,
        highHeight: HIGH,
      }),
    ).resolves.toBe(LOW);
    await expect(
      findZcashHeightAtTimeDirect({
        lightwalletdUrl: 'https://example.test',
        timeSeconds: blockTime(HIGH) + 86_400,
        lowHeight: LOW,
        highHeight: HIGH,
      }),
    ).resolves.toBe(HIGH);
  });

  it('places nothing when the node cannot answer', async () => {
    mockNode(true);
    await expect(
      findZcashHeightAtTimeDirect({
        lightwalletdUrl: 'https://example.test',
        timeSeconds: T0 + 86_400,
        lowHeight: LOW,
        highHeight: HIGH,
      }),
    ).resolves.toBeNull();
  });
});
