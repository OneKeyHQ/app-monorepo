// Smoke test for the vendored StarkWare starknet-privacy SDK entry point.
//
// Asserts the public surface kit-bg will depend on still resolves after the
// local modifications in VENDOR.md, and that importing the entry does not
// evaluate any HPKE/OHTTP code. `ohttp-ts` and `hpke` are mocked virtually so
// the test runs before `yarn install` materializes them.

import { gzipSync, strToU8, zlibSync } from 'fflate';

jest.mock(
  'ohttp-ts',
  () => ({
    OHTTPClient: function MockOHTTPClient() {
      return { encapsulateRequest: async () => ({ init: {}, context: {} }) };
    },
    KeyConfig: { parseMultiple: () => [{}] },
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

jest.mock(
  '@panva/hpke-noble',
  () => ({
    KEM_DHKEM_X25519_HKDF_SHA256: () => ({}),
    KDF_HKDF_SHA256: () => ({}),
    AEAD_AES_128_GCM: () => ({}),
  }),
  { virtual: true },
);

describe('vendored starknet-privacy SDK', () => {
  it('exports the transfer factory and the indexer discovery provider', async () => {
    const sdk = await import('.');

    expect(typeof sdk.createPrivateTransfers).toBe('function');
    expect(typeof sdk.IndexerDiscoveryProvider).toBe('function');
    expect(typeof sdk.ProvingServiceProofProvider).toBe('function');
    expect(typeof sdk.OhttpClient).toBe('function');
  });

  it('keeps the debug flags off by default', async () => {
    const { getSdkDebugFlag, setSdkDebugFlag } = await import('./debugFlags');

    expect(getSdkDebugFlag('SDK_DEBUG')).toBeUndefined();
    setSdkDebugFlag('SDK_DEBUG', '1');
    expect(getSdkDebugFlag('SDK_DEBUG')).toBe('1');
    setSdkDebugFlag('SDK_DEBUG', undefined);
    expect(getSdkDebugFlag('SDK_DEBUG')).toBeUndefined();
  });

  it.each(['gzip', 'deflate'] as const)(
    'reads an encrypted inner response compressed with %s on native',
    async (format) => {
      const { decompressResponseText } =
        await import('./platform/decompressResponseText.native');
      const expected = 'private response ✓';
      const bytes = (format === 'gzip' ? gzipSync : zlibSync)(
        strToU8(expected),
      );
      const response = new Response(new Uint8Array(bytes));
      await expect(decompressResponseText(response, format)).resolves.toBe(
        expected,
      );
    },
  );

  it.each(['default', 'caller'] as const)(
    'uses the same %s deadline for the key lookup and the relay',
    async (mode) => {
      const { OhttpClient } = await import('./internal/ohttp-client');
      const client = new OhttpClient('https://gateway.example', {
        relayUrl: 'https://relay.example',
      });
      const caller = new AbortController();
      const previousFetch = globalThis.fetch;
      const signals: (AbortSignal | null | undefined)[] = [];
      globalThis.fetch = async (url, init) => {
        signals.push(init?.signal);
        if (String(url).endsWith('/ohttp-keys'))
          return new Response(new Uint8Array([1]));
        throw new TypeError('offline');
      };
      try {
        const result =
          mode === 'caller'
            ? client.post('/history', {}, caller.signal)
            : client.get('/history');
        await expect(result).rejects.toThrow('offline');
        const [signal, relaySignal] = signals;
        expect(signals).toHaveLength(2);
        expect(signal).toBeDefined();
        if (mode === 'caller') expect(signal).toBe(caller.signal);
        expect(relaySignal).toBe(signal);
      } finally {
        globalThis.fetch = previousFetch;
      }
    },
  );

  it('produces an abort signal without AbortSignal.timeout', async () => {
    const { timeoutSignal } = await import('./platform/timeoutSignal');
    const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');

    try {
      // @ts-expect-error simulate a runtime that predates AbortSignal.timeout
      delete AbortSignal.timeout;
      const signal = timeoutSignal(5);
      expect(signal.aborted).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toMatchObject({ name: 'TimeoutError' });
    } finally {
      if (descriptor) {
        Object.defineProperty(AbortSignal, 'timeout', descriptor);
      }
    }
  });
});
