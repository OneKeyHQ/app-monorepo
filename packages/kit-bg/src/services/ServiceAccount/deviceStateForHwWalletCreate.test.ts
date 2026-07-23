import { resolveDeviceStateForHwWalletCreate } from './deviceStateForHwWalletCreate';

describe('resolveDeviceStateForHwWalletCreate', () => {
  it('loads the canonical OneKey state before creating the DB record', async () => {
    const state = {
      revision: 2,
      identity: { deviceId: 'DEVICE_ID', displayName: 'My Pro 2' },
      status: { mode: 'normal' },
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

  it('does not let an existing snapshot bypass the live identity read', async () => {
    const existingState = {
      identity: { deviceId: 'OLD_DEVICE_ID' },
      status: { mode: 'normal' },
    } as never;
    const liveState = {
      identity: { deviceId: 'NEW_DEVICE_ID' },
      status: { mode: 'normal' },
    } as never;
    const getDeviceState = jest.fn().mockResolvedValue(liveState);

    await expect(
      resolveDeviceStateForHwWalletCreate({
        existingState,
        isThirdParty: false,
        isMocked: false,
        connectId: 'PRO2_USB',
        getDeviceState,
      }),
    ).resolves.toBe(liveState);
  });

  it('rejects a normal OneKey state without a live device id', async () => {
    const onError = jest.fn();

    await expect(
      resolveDeviceStateForHwWalletCreate({
        isThirdParty: false,
        isMocked: false,
        connectId: 'PRO2_USB',
        getDeviceState: jest.fn().mockResolvedValue({
          identity: { deviceId: null },
          status: { mode: 'normal' },
        }),
        onError,
      }),
    ).rejects.toThrow('Unable to resolve live hardware device identity');
    expect(onError).toHaveBeenCalledTimes(1);
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
