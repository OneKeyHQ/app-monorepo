// Smoke test for the vendored StarkWare starknet-privacy SDK entry point.
//
// Asserts the public surface kit-bg will depend on still resolves after the
// local modifications in VENDOR.md, and that importing the entry does not
// evaluate any HPKE/OHTTP code. `ohttp-ts` and `hpke` are mocked virtually so
// the test runs before `yarn install` materializes them.

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
    } finally {
      if (descriptor) {
        Object.defineProperty(AbortSignal, 'timeout', descriptor);
      }
    }
  });
});
