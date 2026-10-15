import { getZcashHardwareSdk } from './hardwareSdk';

describe('Zcash hardware capability boundary', () => {
  it('rejects an SDK lacking either Zcash capability before calling a device', () => {
    const zcashGetAddress = jest.fn();
    expect(() => getZcashHardwareSdk({ zcashGetAddress })).toThrow(
      'Update the app',
    );
    expect(zcashGetAddress).not.toHaveBeenCalled();
  });
  it.each(['not-hex', 'a', 'ab'.repeat(24 * 1024 + 1)])(
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
});
