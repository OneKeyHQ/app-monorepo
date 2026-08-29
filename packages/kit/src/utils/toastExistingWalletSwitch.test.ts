import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  flushPendingExistingWalletSwitchToast,
  setExistingWalletSwitchToastDeferred,
  toastExistingWalletSwitch,
} from './toastExistingWalletSwitch';

const toastSuccess = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: ({ id }: { id: string }) => id,
    },
    onLocaleChange: jest.fn(),
  },
}));

const wallet = { id: 'hw-hidden-1' } as IDBWallet;
const indexedAccount = { id: 'indexed-1' } as IDBIndexedAccount;

describe('toastExistingWalletSwitch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    toastSuccess.mockClear();
    setExistingWalletSwitchToastDeferred(false);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    setExistingWalletSwitchToastDeferred(false);
  });

  it('does not toast when this passphraseState is imported for the first time', () => {
    toastExistingWalletSwitch({
      wallet,
      indexedAccount,
      isOverrideWallet: false,
      isAttachPinMode: true,
    });
    jest.runAllTimers();

    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('does not toast when the wallet record is missing', () => {
    toastExistingWalletSwitch({
      wallet: undefined as unknown as IDBWallet,
      indexedAccount,
      isOverrideWallet: true,
      isAttachPinMode: true,
    });
    jest.runAllTimers();

    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('uses the Attach PIN copy only when switching to an existing Attach PIN wallet', () => {
    toastExistingWalletSwitch({
      wallet,
      indexedAccount,
      isOverrideWallet: true,
      isAttachPinMode: true,
    });
    jest.runAllTimers();

    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith({
      title: ETranslations.feedback_wallet_exists_title,
      message: ETranslations.feedback_wallet_exsited_due_to_same_pin_desc,
    });
  });

  it('uses the generic copy when switching to an existing passphrase wallet', () => {
    toastExistingWalletSwitch({
      wallet,
      indexedAccount,
      isOverrideWallet: true,
      isAttachPinMode: false,
    });
    jest.runAllTimers();

    expect(toastSuccess).toHaveBeenCalledWith({
      title: ETranslations.feedback_wallet_exists_title,
      message: ETranslations.feedback_wallet_exists_desc,
    });
  });

  it('holds the existing-wallet toast until finalize confirms', () => {
    setExistingWalletSwitchToastDeferred(true);
    toastExistingWalletSwitch({
      wallet,
      indexedAccount,
      isOverrideWallet: true,
      isAttachPinMode: true,
    });
    jest.runAllTimers();
    expect(toastSuccess).not.toHaveBeenCalled();

    flushPendingExistingWalletSwitchToast();
    expect(toastSuccess).toHaveBeenCalledWith({
      title: ETranslations.feedback_wallet_exists_title,
      message: ETranslations.feedback_wallet_exsited_due_to_same_pin_desc,
    });
  });
});
