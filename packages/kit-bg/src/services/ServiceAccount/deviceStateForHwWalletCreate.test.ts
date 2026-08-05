import {
  refreshDeviceStateAfterStandardWalletUnlock,
  resolveDeviceStateForHwWalletCreate,
} from './deviceStateForHwWalletCreate';

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
    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB', {
      scope: 'runtime',
    });
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

  it('创建 Pro1 隐藏钱包时保留现有状态，不发送会打断钱包会话的实时读取', async () => {
    const existingState = {
      identity: { deviceId: 'PRO1_DEVICE_ID' },
      status: { mode: 'normal' },
    } as never;
    const getDeviceState = jest.fn();

    await expect(
      resolveDeviceStateForHwWalletCreate({
        existingState,
        preserveWalletSession: true,
        isThirdParty: false,
        isMocked: false,
        connectId: 'PRO1_USB',
        getDeviceState,
      }),
    ).resolves.toBe(existingState);
    expect(getDeviceState).not.toHaveBeenCalled();
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

describe('refreshDeviceStateAfterStandardWalletUnlock', () => {
  it('刷新 Pro2 标准钱包解锁后的 Passphrase 状态', async () => {
    const lockedState = {
      protocol: 'V2',
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      status: {
        mode: 'normal',
        unlocked: false,
        passphraseProtection: null,
      },
    } as never;
    const unlockedState = {
      protocol: 'V2',
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      status: {
        mode: 'normal',
        unlocked: true,
        passphraseProtection: true,
      },
    } as never;
    const getDeviceState = jest.fn().mockResolvedValue(unlockedState);

    await expect(
      refreshDeviceStateAfterStandardWalletUnlock({
        existingState: lockedState,
        connectProtocol: 'V2',
        isThirdParty: false,
        isMocked: false,
        passphraseState: undefined,
        connectId: 'PRO2_USB',
        getDeviceState,
      }),
    ).resolves.toBe(unlockedState);
    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB', {
      scope: 'runtime',
    });
  });

  it('不刷新 Pro1 或隐藏钱包会话', async () => {
    const existingState = {
      protocol: 'V1',
      identity: { deviceId: 'PRO1_DEVICE_ID' },
      status: { mode: 'normal', passphraseProtection: true },
    } as never;
    const hiddenWalletState = {
      protocol: 'V2',
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      status: { mode: 'normal', passphraseProtection: true },
    } as never;
    const getDeviceState = jest.fn();

    await expect(
      refreshDeviceStateAfterStandardWalletUnlock({
        existingState,
        connectProtocol: 'V1',
        isThirdParty: false,
        isMocked: false,
        passphraseState: undefined,
        connectId: 'PRO1_USB',
        getDeviceState,
      }),
    ).resolves.toBe(existingState);
    await expect(
      refreshDeviceStateAfterStandardWalletUnlock({
        existingState: hiddenWalletState,
        connectProtocol: 'V2',
        isThirdParty: false,
        isMocked: false,
        passphraseState: 'hidden-session',
        connectId: 'PRO2_USB',
        getDeviceState,
      }),
    ).resolves.toBe(hiddenWalletState);
    expect(getDeviceState).not.toHaveBeenCalled();
  });

  it('刷新失败时沿用建钱包前的状态，不阻断钱包创建', async () => {
    const existingState = {
      protocol: 'V2',
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      status: { mode: 'normal', passphraseProtection: null },
    } as never;
    const error = new Error('read failed');
    const onError = jest.fn();

    await expect(
      refreshDeviceStateAfterStandardWalletUnlock({
        existingState,
        connectProtocol: 'V2',
        isThirdParty: false,
        isMocked: false,
        passphraseState: undefined,
        connectId: 'PRO2_USB',
        getDeviceState: jest.fn().mockRejectedValue(error),
        onError,
      }),
    ).resolves.toBe(existingState);
    expect(onError).toHaveBeenCalledWith(error);
  });
});
