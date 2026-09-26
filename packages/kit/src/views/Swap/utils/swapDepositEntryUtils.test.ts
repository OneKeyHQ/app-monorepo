import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { openSwapDepositEntry } from './swapDepositEntryUtils';

const mockBuyOnLowBalance = jest.fn<void, unknown[]>();
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    wallet: {
      walletActions: {
        buyOnLowBalance: (...args: unknown[]) => {
          mockBuyOnLowBalance(...args);
        },
      },
    },
  },
}));

const token = {
  networkId: 'evm--1',
  contractAddress: '0xabc',
  symbol: 'WBTC',
  name: 'Wrapped BTC',
  decimals: 8,
} as unknown as ISwapToken;

const accountInfo = {
  account: { id: 'account-1' },
  wallet: { id: 'wallet-1', type: 'hd' },
} as unknown as IAccountSelectorActiveAccountInfo;

type INavigation = Parameters<typeof openSwapDepositEntry>[0]['navigation'];

describe('openSwapDepositEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the receive selector and counts the funnel event once', () => {
    const pushModal = jest.fn();
    const navigation = { pushModal } as unknown as INavigation;
    const onClose = jest.fn();
    expect(
      openSwapDepositEntry({ navigation, token, accountInfo, onClose }),
    ).toBe(true);
    expect(pushModal).toHaveBeenCalledTimes(1);
    // The QR page gets a Done shortcut and the caller's close hook rides
    // along so the balance can be reloaded after the deposit.
    expect(pushModal.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        params: expect.objectContaining({ showDoneButton: true, onClose }),
      }),
    );
    expect(mockBuyOnLowBalance).toHaveBeenCalledTimes(1);
    expect(mockBuyOnLowBalance).toHaveBeenCalledWith({
      source: 'swap',
      networkId: 'evm--1',
      tokenSymbol: 'WBTC',
      tokenAddress: '0xabc',
      walletType: 'hd',
    });
  });

  it('skips the funnel event for always-visible entries', () => {
    const pushModal = jest.fn();
    const navigation = { pushModal } as unknown as INavigation;
    expect(
      openSwapDepositEntry({
        navigation,
        token,
        accountInfo,
        logLowBalance: false,
      }),
    ).toBe(true);
    expect(pushModal).toHaveBeenCalledTimes(1);
    expect(mockBuyOnLowBalance).not.toHaveBeenCalled();
  });

  it('does nothing without a token or account', () => {
    const pushModal = jest.fn();
    const navigation = { pushModal } as unknown as INavigation;
    expect(openSwapDepositEntry({ navigation, accountInfo })).toBe(false);
    expect(openSwapDepositEntry({ navigation, token })).toBe(false);
    expect(pushModal).not.toHaveBeenCalled();
    expect(mockBuyOnLowBalance).not.toHaveBeenCalled();
  });

  it('skips the funnel event when the selector cannot open', () => {
    const pushModal = jest.fn();
    const navigation = { pushModal } as unknown as INavigation;
    const accountWithoutIds = {
      account: undefined,
      indexedAccount: undefined,
      wallet: { id: 'wallet-1', type: 'hd' },
    } as unknown as IAccountSelectorActiveAccountInfo;
    expect(
      openSwapDepositEntry({
        navigation,
        token,
        accountInfo: accountWithoutIds,
      }),
    ).toBe(false);
    expect(pushModal).not.toHaveBeenCalled();
    expect(mockBuyOnLowBalance).not.toHaveBeenCalled();
  });
});
