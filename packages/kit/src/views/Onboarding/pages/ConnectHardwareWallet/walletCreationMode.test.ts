import { DeviceSessionPinType } from '@onekeyfe/hd-transport';

import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import {
  EHardwareWalletCreationMode,
  getWalletCreationDeviceState,
  resolveAutomaticWalletCreationMode,
  shouldCheckExistingStandardWallet,
} from './walletCreationMode';

function buildState(
  status: Partial<IOneKeyDeviceState['status']>,
): IOneKeyDeviceState {
  return {
    status: {
      unlocked: true,
      unlockedAttachPin: false,
      passphraseProtection: true,
      ...status,
    },
  } as IOneKeyDeviceState;
}

describe('walletCreationMode', () => {
  it('Protocol V2 创建钱包前使用 Any 解锁并读取包含设备名称的设置状态', async () => {
    const unlockedState = buildState({ unlocked: true });
    const settingsState = {
      ...unlockedState,
      identity: { label: 'My Pro 2' },
    } as IOneKeyDeviceState;
    let resolveUnlock!: (state: IOneKeyDeviceState) => void;
    const unlockPromise = new Promise<IOneKeyDeviceState>((resolve) => {
      resolveUnlock = resolve;
    });
    const getDeviceState = jest.fn().mockResolvedValue(settingsState);
    const getDeviceStateWithUnlock = jest.fn().mockReturnValue(unlockPromise);

    const resultPromise = getWalletCreationDeviceState({
      serviceHardware: { getDeviceState, getDeviceStateWithUnlock },
      connectId: 'pro2-connect',
      connectProtocol: 'V2',
    });

    expect(getDeviceStateWithUnlock).toHaveBeenCalledWith({
      connectId: 'pro2-connect',
      pinType: DeviceSessionPinType.Any,
      params: { connectProtocol: 'V2', scope: 'runtime' },
    });
    expect(getDeviceState).not.toHaveBeenCalled();

    resolveUnlock(unlockedState);
    await expect(resultPromise).resolves.toBe(settingsState);

    expect(getDeviceState).toHaveBeenCalledWith({
      connectId: 'pro2-connect',
      params: { connectProtocol: 'V2', scope: 'settings' },
    });
  });

  it('Protocol V1 直接使用 settings scope 读取完整状态', async () => {
    const state = buildState({ unlocked: true });
    const settingsState = {
      ...state,
      identity: { label: 'My Classic' },
    } as IOneKeyDeviceState;
    const getDeviceState = jest.fn();
    const getDeviceStateWithUnlock = jest.fn().mockResolvedValue(settingsState);

    await expect(
      getWalletCreationDeviceState({
        serviceHardware: { getDeviceState, getDeviceStateWithUnlock },
        connectId: 'classic-connect',
        connectProtocol: 'V1',
      }),
    ).resolves.toBe(settingsState);

    expect(getDeviceStateWithUnlock).toHaveBeenCalledWith({
      connectId: 'classic-connect',
      params: { connectProtocol: 'V1', scope: 'settings' },
    });
    expect(getDeviceState).not.toHaveBeenCalled();
  });

  it('锁定状态不提前选择钱包模式', () => {
    const state = buildState({ unlocked: false });

    expect(shouldCheckExistingStandardWallet(state)).toBe(false);
    expect(
      resolveAutomaticWalletCreationMode({
        state,
        existsStandardWallet: false,
      }),
    ).toBeUndefined();
  });

  it('attach PIN 隐藏钱包直接进入隐藏钱包流程', () => {
    const state = buildState({ unlockedAttachPin: true });

    expect(shouldCheckExistingStandardWallet(state)).toBe(false);
    expect(
      resolveAutomaticWalletCreationMode({
        state,
        existsStandardWallet: false,
      }),
    ).toBe(EHardwareWalletCreationMode.Hidden);
  });

  it('attach PIN 解锁结果优先于缓存中的 passphrase 开关状态', () => {
    const state = buildState({
      unlockedAttachPin: true,
      passphraseProtection: false,
    });

    expect(
      resolveAutomaticWalletCreationMode({
        state,
        existsStandardWallet: false,
      }),
    ).toBe(EHardwareWalletCreationMode.Hidden);
  });

  it('已有标准钱包且启用 passphrase 时直接创建隐藏钱包', () => {
    const state = buildState({});

    expect(shouldCheckExistingStandardWallet(state)).toBe(true);
    expect(
      resolveAutomaticWalletCreationMode({
        state,
        existsStandardWallet: true,
      }),
    ).toBe(EHardwareWalletCreationMode.Hidden);
  });

  it('首次连接且启用 passphrase 时交给用户明确选择', () => {
    expect(
      resolveAutomaticWalletCreationMode({
        state: buildState({}),
        existsStandardWallet: false,
      }),
    ).toBeUndefined();
  });

  it('未启用 passphrase 时只创建标准钱包', () => {
    expect(
      resolveAutomaticWalletCreationMode({
        state: buildState({ passphraseProtection: false }),
        existsStandardWallet: false,
      }),
    ).toBe(EHardwareWalletCreationMode.Standard);
  });
});
