import {
  WALLET_TYPE_HD,
  WALLET_TYPE_IMPORTED,
} from '@onekeyhq/shared/src/consts/dbConsts';

import { resolveNativeHomeWalletState } from './nativeHomeWalletState';

const readyState = {
  activeAccountReady: true,
  accountSelectorStorageInitDone: true,
  activeAccountInitDone: true,
};

describe('resolveNativeHomeWalletState', () => {
  it.each([
    ['active account', { activeAccountReady: false }],
    ['account selector storage', { accountSelectorStorageInitDone: false }],
    ['active account initialization', { activeAccountInitDone: false }],
  ])('waits for the %s verdict', (_name, override) => {
    expect(
      resolveNativeHomeWalletState({
        ...readyState,
        walletType: WALLET_TYPE_HD,
        walletBackedUp: false,
        ...override,
      }),
    ).toBe('pending');
  });

  it('shows the backup body only for a resolved unbacked HD wallet', () => {
    expect(
      resolveNativeHomeWalletState({
        ...readyState,
        walletType: WALLET_TYPE_HD,
        walletBackedUp: false,
      }),
    ).toBe('notBackedUp');
  });

  it('keeps a backed HD wallet on the normal Native Home', () => {
    expect(
      resolveNativeHomeWalletState({
        ...readyState,
        walletType: WALLET_TYPE_HD,
        walletBackedUp: true,
      }),
    ).toBe('normal');
  });

  it('does not treat an imported wallet as an unbacked HD wallet', () => {
    expect(
      resolveNativeHomeWalletState({
        ...readyState,
        walletType: WALLET_TYPE_IMPORTED,
        walletBackedUp: false,
      }),
    ).toBe('normal');
  });

  it('leaves a resolved no-wallet state to the normal empty-wallet path', () => {
    expect(
      resolveNativeHomeWalletState({
        ...readyState,
        walletType: undefined,
        walletBackedUp: undefined,
      }),
    ).toBe('normal');
  });
});
