/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IEarnPayWithToken } from '@onekeyhq/shared/src/routes';
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
  [
    unknown,
    {
      params: {
        heldTokens?: IEarnPayWithToken[];
        onSelect: (token: IEarnPayWithToken) => void;
      };
    },
  ]
>();
const indexedAccountBySource: Record<string, string> = {
  'source-a': 'wallet-a',
  'source-b': 'wallet-b',
  'source-next': 'wallet-a',
  'source-btc-alternate': 'wallet-a',
  'source-btc-default': 'wallet-a',
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
  const { mergePickedPayTokens } = jest.requireActual<
    typeof import('../EarnRouter/earnRouter.utils')
  >('../EarnRouter/earnRouter.utils');
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
      tokens: mergePickedPayTokens(
        mockHeldTokens,
        useSyncExternalStore(subscribe, () => mockPickedTokens),
      ),
      isLoaded: true,
    }),
  };
});
jest.mock('../EarnRouter/earnRouterSwap', () => ({
  fetchEarnSwapQuote: jest.fn(async () => undefined),
}));
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
const btcToken: ISwapToken = {
  networkId: 'btc--0',
  contractAddress: '',
  symbol: 'BTC',
  decimals: 8,
  isNative: true,
};
const alternateBtc: IEarnRouterPayToken = {
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

it('keeps the new bridge selection while its source is resolving and the picker reopens', async () => {
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

  const onReopenedPick = jest.fn();
  act(() => result.current.openPicker(onReopenedPick));
  await act(async () => nextSource.resolve('source-next'));
  await waitFor(() => expect(result.current.canSwap).toBe(true));
  expect(result.current.payToken?.accountId).toBe('source-next');
  expect(result.current.fundingKey).toContain('source-next');
  expect(result.current.fundingKey).not.toContain('source-a');
  expect(onPicked).toHaveBeenCalledTimes(1);
  expect(onReopenedPick).not.toHaveBeenCalled();
});

it('retries the exact held derivation when the same token is reselected', async () => {
  const loanAccount = { accountId: '', indexedAccountId: 'wallet-a' };
  mockHeldTokens = [alternateBtc];
  mockGetAccountAddressInfo.mockRejectedValueOnce(new Error('Unavailable'));
  jest.mocked(getLoanNetworkAccountId).mockResolvedValue('source-btc-default');

  const { result } = renderHook(() =>
    useLoanPayWith({
      route,
      loanAccount,
      networkAccountId: 'receiver-a',
      typedAmount: '',
      isLocked: false,
      startKey: alternateBtc.key,
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
    accountId: alternateBtc.accountId,
    networkId: btcToken.networkId,
  });
  expect(result.current.canSwap).toBe(true);
  expect(result.current.fundingKey).toContain(alternateBtc.accountId);
});

it('keeps the selected BTC derivation when its wallet balance disappears', async () => {
  const defaultBtc: IEarnRouterPayToken = {
    ...alternateBtc,
    key: 'btc-default-holding',
    accountId: 'source-btc-default',
    token: { ...alternateBtc.token, $key: 'btc-default-holding' },
    amount: '1',
    fiatValueUsd: '1',
  };
  mockHeldTokens = [alternateBtc, defaultBtc];
  const loanAccount = { accountId: '', indexedAccountId: 'wallet-a' };
  const useTestPayWith = (
    props: Pick<
      Parameters<typeof useLoanPayWith>[0],
      'startKey' | 'typedAmount'
    >,
  ) =>
    useLoanPayWith({
      ...props,
      route,
      loanAccount,
      networkAccountId: 'receiver-a',
      isLocked: false,
      markets: [],
    });
  const initialProps: Parameters<typeof useTestPayWith>[0] = {
    startKey: alternateBtc.key,
    typedAmount: '',
  };
  const view = renderHook(useTestPayWith, { initialProps });
  const { result } = view;
  await waitFor(() => expect(result.current.canSwap).toBe(true));
  expect(result.current.fundingKey).toContain(alternateBtc.accountId);

  const onPicked = jest.fn();
  act(() => result.current.openPicker(onPicked));
  const params = mockPushModal.mock.calls.at(-1)?.[1].params;
  const defaultRow = params?.heldTokens?.[1];
  expect(defaultRow?.balanceParsed).toBe('1');
  await act(async () => {
    if (defaultRow) params?.onSelect(defaultRow);
  });

  expect(result.current.payToken?.accountId).toBe(defaultBtc.accountId);
  expect(result.current.payToken?.amount).toBe('1');
  expect(result.current.canSwap).toBe(true);
  expect(result.current.fundingKey).toContain(defaultBtc.accountId);
  expect(result.current.fundingKey).not.toContain(alternateBtc.accountId);
  expect(params?.heldTokens?.map((token) => token.payWithAccountId)).toEqual([
    alternateBtc.accountId,
    defaultBtc.accountId,
  ]);
  expect(onPicked).toHaveBeenCalledWith(true);

  const selectedFundingKey = result.current.fundingKey;
  const retained = { startKey: result.current.pickedKey, typedAmount: '0.5' };
  expect(retained.startKey).toBeDefined();
  view.rerender(retained);
  mockHeldTokens = [alternateBtc];
  view.rerender(retained);
  const afterRemoval = result.current;
  await act(async () => {});
  expect(afterRemoval.payToken?.accountId).toBe(defaultBtc.accountId);
  expect(afterRemoval.payToken?.isHoldingFallback).toBe(true);
  expect(afterRemoval.payToken?.amount).toBe('0');
  expect(afterRemoval.payMax).toBe('0');
  expect(afterRemoval.canSwap).toBe(false);
  expect(afterRemoval.fundingKey).toBe(selectedFundingKey);

  view.unmount();
  const reopened = renderHook(useTestPayWith, { initialProps: retained });
  await waitFor(() =>
    expect(reopened.result.current.fundingKey).toBe(selectedFundingKey),
  );
  expect(reopened.result.current.payToken?.accountId).toBe(
    defaultBtc.accountId,
  );
  expect(reopened.result.current.payToken?.amount).toBe('0');
  expect(reopened.result.current.canSwap).toBe(false);

  mockHeldTokens = [alternateBtc, defaultBtc];
  reopened.rerender(retained);
  expect(reopened.result.current.payToken?.amount).toBe('1');
  expect(reopened.result.current.canSwap).toBe(true);
  expect(reopened.result.current.fundingKey).toBe(selectedFundingKey);
});
