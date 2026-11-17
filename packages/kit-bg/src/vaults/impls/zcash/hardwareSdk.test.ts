import { getZcashHardwareSdk } from './hardwareSdk';
import { ZCASH_PCZT_HEX_MAX_CHARS } from './transactionReview';

// Every method the wrapper needs; tests override the ones they exercise.
const zcashMethods = () => ({
  zcashGetAddress: jest.fn(),
  zcashGetFullViewingKey: jest.fn(),
  zcashSignPczt: jest.fn(),
});

describe('Zcash hardware capability boundary', () => {
  it.each(['zcashGetAddress', 'zcashGetFullViewingKey', 'zcashSignPczt'])(
    'rejects an SDK lacking %s before calling a device',
    (missing) => {
      const methods: Record<string, jest.Mock> = zcashMethods();
      delete methods[missing];
      expect(() => getZcashHardwareSdk(methods)).toThrow('Update the app');
      for (const method of Object.values(methods)) {
        expect(method).not.toHaveBeenCalled();
      }
    },
  );
  it.each(['not-hex', 'a', 'ab'.repeat(ZCASH_PCZT_HEX_MAX_CHARS / 2 + 1)])(
    'rejects invalid signed PCZT payload',
    async (pczt) => {
      const sdk = getZcashHardwareSdk({
        ...zcashMethods(),
        zcashSignPczt: async () => ({ success: true, payload: { pczt } }),
      });
      await expect(
        sdk.zcashSignPczt('connect', 'device', { pczt: 'aabb' }),
      ).rejects.toThrow();
    },
  );
  it('accepts a signed PCZT larger than any device buffer', async () => {
    const pczt = 'ab'.repeat(64 * 1024);
    const sdk = getZcashHardwareSdk({
      ...zcashMethods(),
      zcashSignPczt: async () => ({ success: true, payload: { pczt } }),
    });
    await expect(
      sdk.zcashSignPczt('connect', 'device', { pczt: 'aabb' }),
    ).resolves.toEqual({ success: true, payload: { pczt } });
  });
  it.each([false, true])(
    'normalizes absent optional address metadata and preserves supplied metadata (bundle=%s)',
    async (bundle) => {
      for (const metadata of [
        {},
        { seedFingerprint: null },
        { seedFingerprint: 'ab'.repeat(32) },
      ]) {
        const address = { path: "m/32'/133'/0'", address: 't1-test-address' };
        const payload = { ...address, ...metadata };
        const sdk = getZcashHardwareSdk({
          ...zcashMethods(),
          zcashGetAddress: async () => ({
            success: true,
            payload: bundle ? [payload] : payload,
          }),
        });
        const expected = {
          ...address,
          seedFingerprint: metadata.seedFingerprint ?? undefined,
        };
        await expect(
          sdk.zcashGetAddress(
            'connect',
            'device',
            bundle
              ? { bundle: [{ path: address.path }] }
              : { path: address.path },
          ),
        ).resolves.toEqual({
          success: true,
          payload: bundle ? [expected] : expected,
        });
      }
    },
  );
  it.each([
    { address: undefined },
    { address: null },
    { address: '' },
    { seedFingerprint: '' },
    { seedFingerprint: 'not-hex' },
  ])('still rejects malformed address fields: %j', async (invalidFields) => {
    const sdk = getZcashHardwareSdk({
      ...zcashMethods(),
      zcashGetAddress: async () => ({
        success: true,
        payload: [
          {
            path: "m/32'/133'/0'",
            address: 't1-test-address',
            seedFingerprint: null,
            ...invalidFields,
          },
        ],
      }),
    });
    await expect(
      sdk.zcashGetAddress('connect', 'device', { bundle: [{}] }),
    ).rejects.toThrow('malformed hardware address');
  });
  it('validates every address in a bundle and preserves structured device errors', async () => {
    const sdk = getZcashHardwareSdk({
      ...zcashMethods(),
      zcashSignPczt: async () => ({
        success: false,
        payload: { code: 800, error: 'Cancelled' },
      }),
      zcashGetAddress: async () => ({
        success: true,
        payload: [{ path: "m/32'/133'/0'", address: 'u1' }, { address: 'u2' }],
      }),
    });
    await expect(
      sdk.zcashGetAddress('connect', 'device', { bundle: [{}, {}] }),
    ).rejects.toThrow();
    await expect(
      sdk.zcashSignPczt('connect', 'device', { pczt: 'aabb' }),
    ).resolves.toEqual({
      success: false,
      payload: { code: 800, error: 'Cancelled' },
    });
  });
  it('keeps object error params and drops non-object ones', async () => {
    let params: unknown = { reason: 'busy' };
    const sdk = getZcashHardwareSdk({
      ...zcashMethods(),
      zcashSignPczt: async () => ({
        success: false,
        payload: { error: 'Failed', params },
      }),
    });
    await expect(
      sdk.zcashSignPczt('connect', 'device', { pczt: 'aabb' }),
    ).resolves.toEqual({
      success: false,
      payload: { error: 'Failed', params: { reason: 'busy' } },
    });
    params = 'busy';
    await expect(
      sdk.zcashSignPczt('connect', 'device', { pczt: 'aabb' }),
    ).resolves.toEqual({
      success: false,
      payload: { error: 'Failed', params: undefined },
    });
  });
  it('returns the confirmed viewing key and keeps device errors', async () => {
    const zcashGetFullViewingKey = jest
      .fn()
      .mockResolvedValueOnce({
        success: true,
        payload: { path: "m/32'/133'/0'", ufvk: 'uview1device' },
      })
      .mockResolvedValueOnce({
        success: false,
        payload: { code: 800, error: 'Cancelled' },
      });
    const sdk = getZcashHardwareSdk({
      ...zcashMethods(),
      zcashGetFullViewingKey,
    });
    const params = { path: "m/32'/133'/0'" };
    await expect(
      sdk.zcashGetFullViewingKey('connect', 'device', params),
    ).resolves.toEqual({
      success: true,
      payload: { path: "m/32'/133'/0'", ufvk: 'uview1device' },
    });
    await expect(
      sdk.zcashGetFullViewingKey('connect', 'device', params),
    ).resolves.toEqual({
      success: false,
      payload: { code: 800, error: 'Cancelled' },
    });
    expect(zcashGetFullViewingKey).toHaveBeenCalledWith(
      'connect',
      'device',
      params,
    );
  });
  it.each([{}, { ufvk: '' }, { ufvk: null }, { path: '' }])(
    'rejects a malformed viewing key reply: %j',
    async (invalidFields) => {
      const sdk = getZcashHardwareSdk({
        ...zcashMethods(),
        zcashGetFullViewingKey: async () => ({
          success: true,
          payload: { path: "m/32'/133'/0'", ...invalidFields },
        }),
      });
      await expect(
        sdk.zcashGetFullViewingKey('connect', 'device', { path: 'x' }),
      ).rejects.toThrow('malformed hardware viewing key');
    },
  );
});
