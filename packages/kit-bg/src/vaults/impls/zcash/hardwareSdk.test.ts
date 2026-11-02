import { getZcashHardwareSdk } from './hardwareSdk';
import { ZCASH_PCZT_HEX_MAX_CHARS } from './transactionReview';

describe('Zcash hardware capability boundary', () => {
  it('rejects an SDK lacking either Zcash capability before calling a device', () => {
    const zcashGetAddress = jest.fn();
    expect(() => getZcashHardwareSdk({ zcashGetAddress })).toThrow(
      'Update the app',
    );
    expect(zcashGetAddress).not.toHaveBeenCalled();
  });
  it.each(['not-hex', 'a', 'ab'.repeat(ZCASH_PCZT_HEX_MAX_CHARS / 2 + 1)])(
    'rejects invalid signed PCZT payload',
    async (pczt) => {
      const sdk = getZcashHardwareSdk({
        zcashGetAddress: async () => undefined,
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
      zcashGetAddress: async () => undefined,
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
        { ufvk: null, seedFingerprint: null },
        { ufvk: 'viewing-key', seedFingerprint: 'ab'.repeat(32) },
      ]) {
        const address = { path: "m/32'/133'/0'", address: 't1-test-address' };
        const payload = { ...address, ...metadata };
        const sdk = getZcashHardwareSdk({
          zcashSignPczt: jest.fn(),
          zcashGetAddress: async () => ({
            success: true,
            payload: bundle ? [payload] : payload,
          }),
        });
        const expected = {
          ...address,
          ufvk: metadata.ufvk ?? undefined,
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
    { ufvk: '' },
    { seedFingerprint: '' },
    { seedFingerprint: 'not-hex' },
  ])('still rejects malformed address fields: %j', async (invalidFields) => {
    const sdk = getZcashHardwareSdk({
      zcashSignPczt: jest.fn(),
      zcashGetAddress: async () => ({
        success: true,
        payload: [
          {
            path: "m/32'/133'/0'",
            address: 't1-test-address',
            ufvk: null,
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
      zcashSignPczt: async () => ({
        success: false,
        payload: { error: 'Failed', params },
      }),
      zcashGetAddress: async () => ({ success: true, payload: {} }),
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
});
