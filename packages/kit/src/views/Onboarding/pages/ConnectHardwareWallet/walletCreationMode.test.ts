import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import {
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
  it('Protocol V2 创建钱包前只读取状态，不提前解锁', async () => {
    const state = buildState({ unlocked: false });
    const getDeviceState = jest.fn().mockResolvedValue(state);
    const getDeviceStateWithUnlock = jest.fn();

    await expect(
      getWalletCreationDeviceState({
        serviceHardware: { getDeviceState, getDeviceStateWithUnlock },
        connectId: 'pro2-connect',
        connectProtocol: 'V2',
      }),
    ).resolves.toBe(state);

    expect(getDeviceState).toHaveBeenCalledWith({
      connectId: 'pro2-connect',
      params: { connectProtocol: 'V2', scope: 'runtime' },
    });
    expect(getDeviceStateWithUnlock).not.toHaveBeenCalled();
  });

  it('Protocol V1 保留创建钱包前的原有解锁流程', async () => {
    const state = buildState({ unlocked: true });
    const getDeviceState = jest.fn();
    const getDeviceStateWithUnlock = jest.fn().mockResolvedValue(state);

    await expect(
      getWalletCreationDeviceState({
        serviceHardware: { getDeviceState, getDeviceStateWithUnlock },
        connectId: 'classic-connect',
        connectProtocol: 'V1',
      }),
    ).resolves.toBe(state);

    expect(getDeviceStateWithUnlock).toHaveBeenCalledWith({
      connectId: 'classic-connect',
      params: { connectProtocol: 'V1', scope: 'runtime' },
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
    ).toBe('hidden');
  });

  it('已有标准钱包且启用 passphrase 时直接创建隐藏钱包', () => {
    const state = buildState({});

    expect(shouldCheckExistingStandardWallet(state)).toBe(true);
    expect(
      resolveAutomaticWalletCreationMode({
        state,
        existsStandardWallet: true,
      }),
    ).toBe('hidden');
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
    ).toBe('standard');
  });
});
