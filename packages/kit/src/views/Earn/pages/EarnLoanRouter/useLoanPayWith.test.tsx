/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useLoanPayWith } from './useLoanPayWith';
import { getLoanNetworkAccountId } from './useLoanRouterFacts';

import type { ILoanRoute } from './loanRouter.utils';
import type { IEarnRouterPayToken } from '../EarnRouter/earnRouter.utils';

const sourceNetworkId = 'evm--8453';
const oldPick: IEarnRouterPayToken = {
  key: 'earn-pay-picked|evm--8453|0xusdc',
  networkId: sourceNetworkId,
  accountId: 'source-a',
  token: {
    $key: 'earn-pay-picked|evm--8453|0xusdc',
    address: '0xusdc',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    networkId: sourceNetworkId,
    logoURI: '',
  },
  amount: '5',
  fiatValueUsd: '5',
  priceUsd: '1',
  isDepositToken: false,
};
let mockHeldTokens: IEarnRouterPayToken[] = [];
let mockPickedTokens = [oldPick];
const mockPickerListeners = new Set<() => void>();
const mockPushModal = jest.fn<
  void,
  [unknown, { params: { onSelect: (token: ISwapToken) => void } }]
>();
const indexedAccountBySource: Record<string, string> = {
  'source-a': 'wallet-a',
  'source-b': 'wallet-b',
  'source-next': 'wallet-a',
  'source-btc-alternate': 'wallet-a',
};
const mockGetAccountAddressInfo = jest.fn(
  async ({ accountId }: { accountId: string; networkId: string }) => ({
    address: `0x${accountId}`,
    account: {
      id: accountId,
      indexedAccountId: indexedAccountBySource[accountId],
    },
  }),
);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({ useMedia: () => ({ gtMd: true }) }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: async ({ accountId }: { accountId: string }) =>
        `0x${accountId}`,
      getAccountAddressInfoForApi: (
        params: Parameters<typeof mockGetAccountAddressInfo>[0],
      ) => mockGetAccountAddressInfo(params),
    },
    serviceSwap: { fetchSwapNativeTokenConfig: jest.fn(async () => undefined) },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const { useEffect, useState } =
    jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: <T,>(read: () => Promise<T>, deps: unknown[]) => {
      const [result, setResult] = useState<T>();
      useEffect(() => {
        let current = true;
        void read().then((value) => {
          if (current) setResult(value);
        });
        return () => {
          current = false;
        };
        // Mirror the dependency-driven promise hook, which retains its last result.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      return { result };
    },
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: jest.fn() }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd' } }],
  useTokenSelectorFilterPersistAtom: () => [{ swapShowLpTokensOnly: false }],
}));
jest.mock('../../../Staking/router', () => ({
  preloadEarnPayWithTokenSelect: jest.fn(),
}));
jest.mock('../EarnRouter/earnFundingRegistry', () => ({
  useEarnFunding: jest.fn(),
}));
jest.mock('../EarnRouter/earnPayWithPickerData', () => ({
  readPayWithPickerAccountAddress: jest.fn(),
  readPayWithPickerNetwork: jest.fn(),
  warmPayWithPickerTokens: jest.fn(),
}));
jest.mock('../EarnRouter/EarnRouterPayWith', () => {
  const { useSyncExternalStore } =
    jest.requireActual<typeof import('react')>('react');
  const subscribe = (listener: () => void) => {
    mockPickerListeners.add(listener);
    return () => mockPickerListeners.delete(listener);
  };
  return {
    refreshPickedPayToken: jest.fn(),
    rememberPickedPayToken: (
      _networkId: string,
      item: IEarnRouterPayToken,
      expectedItem?: IEarnRouterPayToken,
    ) => {
      if (
        expectedItem &&
        mockPickedTokens.find((pick) => pick.key === item.key) !== expectedItem
      ) {
        return false;
      }
      mockPickedTokens = [
        ...mockPickedTokens.filter((pick) => pick.key !== item.key),
        item,
      ];
      mockPickerListeners.forEach((listener) => listener());
      return true;
    },
    usePayTokens: () => ({
      heldTokens: mockHeldTokens,
      tokens: [
        ...mockHeldTokens,
        ...useSyncExternalStore(subscribe, () => mockPickedTokens),
      ],
      isLoaded: true,
    }),
  };
});
jest.mock('../EarnRouter/earnRouterSwap', () => ({}));
jest.mock('../EarnRouter/earnRouterSwapHistory', () => ({}));
jest.mock('./useLoanRouterFacts', () => ({
  getLoanNetworkAccountId: jest.fn(),
}));

const marketNetworkId = 'evm--1';
const route: ILoanRoute = {
  key: 'market',
  marketLabel: 'Aave',
  market: {
    provider: 'Aave',
    networkId: marketNetworkId,
    name: 'Aave',
    logoURI: '',
    marketAddress: '0xmarket',
    network: {
      networkId: marketNetworkId,
      network: 'Ethereum',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      logoURI: '',
      indexerSupported: true,
      fallbackSupported: true,
      nativeTokenAddress: '',
      coingeckoPlatform: 'ethereum',
      nativeTokenCoingeckoId: 'ethereum',
    },
  },
  collateral: {
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: '',
    address: '0xusdc',
    decimals: 6,
    networkId: marketNetworkId,
    reserveAddress: '0xusdc',
    supplyApy: 1,
    liquidationLtv: 0.8,
  },
  borrow: {
    symbol: 'USDT',
    name: 'Tether',
    logoURI: '',
    address: '0xusdt',
    decimals: 6,
    networkId: marketNetworkId,
    reserveAddress: '0xusdt',
    borrowApy: 2,
    borrowFactor: 1,
  },
};
beforeEach(() => {
  mockHeldTokens = [];
  mockPickedTokens = [oldPick];
  mockPushModal.mockClear();
  mockGetAccountAddressInfo.mockClear();
  jest.mocked(getLoanNetworkAccountId).mockReset();
});

it('disables bridge funding when a cached choice belongs to the previous wallet', async () => {
  const walletA = { accountId: '', indexedAccountId: 'wallet-a' };
  const walletB = { accountId: '', indexedAccountId: 'wallet-b' };
  const view = renderHook(
    ({ loanAccount, networkAccountId }) =>
      useLoanPayWith({
        route,
        loanAccount,
        networkAccountId,
        typedAmount: '',
        isLocked: false,
        startKey: oldPick.key,
        markets: [],
      }),
    { initialProps: { loanAccount: walletA, networkAccountId: 'receiver-a' } },
  );

  await waitFor(() => expect(view.result.current.canSwap).toBe(true));
  expect(view.result.current.fundingKey).toContain('source-a');
  const onPicked = jest.fn();
  act(() => view.result.current.openPicker(onPicked));
  const oldPickerSelect = mockPushModal.mock.calls.at(-1)?.[1].params.onSelect;
  expect(oldPickerSelect).toBeDefined();

  view.rerender({ loanAccount: walletB, networkAccountId: 'receiver-b' });
  const afterSwitch = view.result.current;
  await act(async () => {});
  expect(afterSwitch.canSwap).toBe(false);
  expect(afterSwitch.fundingKey).toBe('');
  expect(view.result.current.canSwap).toBe(false);
  expect(view.result.current.fundingKey).toBe('');
  await act(async () => {
    oldPickerSelect?.({
      networkId: marketNetworkId,
      contractAddress: '0xunused',
      symbol: 'DAI',
      decimals: 18,
      isNative: false,
    });
  });
  expect(onPicked).not.toHaveBeenCalled();
  expect(view.result.current.pickedKey).toBe(oldPick.key);

  mockHeldTokens = [
    { ...oldPick, key: 'current-holding', accountId: 'source-b' },
  ];
  view.rerender({ loanAccount: walletB, networkAccountId: 'receiver-b' });
  act(() => view.result.current.setPickedKey('current-holding'));
  await waitFor(() => expect(view.result.current.canSwap).toBe(true));
  expect(view.result.current.fundingKey).toContain('source-b');
  expect(view.result.current.fundingKey).toContain('receiver-b');
  expect(view.result.current.fundingKey).not.toContain('source-a');
});

it('replaces the previous bridge as soon as an unheld token is picked', async () => {
  const loanAccount = { accountId: '', indexedAccountId: 'wallet-a' };
  const nextSource = Promise.withResolvers<string>();
  const nextToken: ISwapToken = {
    networkId: 'evm--42161',
    contractAddress: '0xdai',
    symbol: 'DAI',
    decimals: 18,
    balanceParsed: '8',
    isNative: false,
  };
  jest.mocked(getLoanNetworkAccountId).mockReturnValue(nextSource.promise);
  const { result } = renderHook(() =>
    useLoanPayWith({
      route,
      loanAccount,
      networkAccountId: 'receiver-a',
      typedAmount: '',
      isLocked: false,
      startKey: oldPick.key,
      markets: [],
    }),
  );

  await waitFor(() => expect(result.current.canSwap).toBe(true));
  expect(result.current.fundingKey).toContain('source-a');

  const onPicked = jest.fn();
  act(() => result.current.openPicker(onPicked));
  const select = mockPushModal.mock.calls.at(-1)?.[1].params.onSelect;
  expect(select).toBeDefined();
  act(() => select?.(nextToken));

  expect(onPicked).toHaveBeenCalledWith(true);
  expect(result.current.payToken?.token.address).toBe(
    nextToken.contractAddress,
  );
  expect(result.current.canSwap).toBe(false);
  expect(result.current.fundingKey).toBe('');
  expect(getLoanNetworkAccountId).toHaveBeenCalledWith({
    account: loanAccount,
    networkId: nextToken.networkId,
  });

  await act(async () => nextSource.resolve('source-next'));
  await waitFor(() => expect(result.current.canSwap).toBe(true));
  expect(result.current.payToken?.accountId).toBe('source-next');
  expect(result.current.fundingKey).toContain('source-next');
  expect(result.current.fundingKey).not.toContain('source-a');
  expect(onPicked).toHaveBeenCalledTimes(1);
});

it('retries the exact held derivation when the same token is reselected', async () => {
  const loanAccount = { accountId: '', indexedAccountId: 'wallet-a' };
  const btcToken: ISwapToken = {
    networkId: 'btc--0',
    contractAddress: '',
    symbol: 'BTC',
    decimals: 8,
    isNative: true,
  };
  const alternate: IEarnRouterPayToken = {
    ...oldPick,
    key: 'btc-alternate-holding',
    networkId: btcToken.networkId,
    accountId: 'source-btc-alternate',
    token: {
      ...oldPick.token,
      $key: 'btc-alternate-holding',
      address: btcToken.contractAddress,
      symbol: btcToken.symbol,
      name: 'Bitcoin',
      decimals: btcToken.decimals,
      isNative: true,
      networkId: btcToken.networkId,
    },
  };
  mockHeldTokens = [alternate];
  mockGetAccountAddressInfo.mockRejectedValueOnce(new Error('Unavailable'));
  jest.mocked(getLoanNetworkAccountId).mockResolvedValue('source-btc-default');

  const { result } = renderHook(() =>
    useLoanPayWith({
      route,
      loanAccount,
      networkAccountId: 'receiver-a',
      typedAmount: '',
      isLocked: false,
      startKey: alternate.key,
      markets: [],
    }),
  );
  await act(async () => {});
  expect(mockGetAccountAddressInfo).toHaveBeenCalledTimes(1);
  expect(result.current.canSwap).toBe(false);

  const onPicked = jest.fn();
  act(() => result.current.openPicker(onPicked));
  const select = mockPushModal.mock.calls.at(-1)?.[1].params.onSelect;
  expect(select).toBeDefined();
  await act(async () => select?.(btcToken));

  expect(onPicked).toHaveBeenCalledWith(false);
  expect(mockGetAccountAddressInfo).toHaveBeenCalledTimes(2);
  expect(mockGetAccountAddressInfo).toHaveBeenLastCalledWith({
    accountId: alternate.accountId,
    networkId: btcToken.networkId,
  });
  expect(result.current.canSwap).toBe(true);
  expect(result.current.fundingKey).toContain(alternate.accountId);
});
