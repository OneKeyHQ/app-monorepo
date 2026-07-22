import { resolveDeviceStateForHwWalletCreate } from './deviceStateForHwWalletCreate';

describe('resolveDeviceStateForHwWalletCreate', () => {
  it('loads the canonical OneKey state before creating the DB record', async () => {
    const state = {
      revision: 2,
      identity: { displayName: 'My Pro 2' },
    } as never;
    const getDeviceState = jest.fn().mockResolvedValue(state);

    await expect(
      resolveDeviceStateForHwWalletCreate({
        isThirdParty: false,
        isMocked: false,
        connectId: 'PRO2_USB',
        getDeviceState,
      }),
    ).resolves.toBe(state);
    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB');
  });

  it('does not add SDK state requirements to third-party wallet creation', async () => {
    const getDeviceState = jest.fn();

    await expect(
      resolveDeviceStateForHwWalletCreate({
        isThirdParty: true,
        isMocked: false,
        connectId: 'LEDGER_USB',
        getDeviceState,
      }),
    ).resolves.toBeUndefined();
    expect(getDeviceState).not.toHaveBeenCalled();
  });
});
