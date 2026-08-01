import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import {
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
  it('锁定状态只创建标准钱包', () => {
    const state = buildState({ unlocked: false });

    expect(shouldCheckExistingStandardWallet(state)).toBe(false);
    expect(
      resolveAutomaticWalletCreationMode({
        state,
        existsStandardWallet: false,
      }),
    ).toBe('standard');
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
