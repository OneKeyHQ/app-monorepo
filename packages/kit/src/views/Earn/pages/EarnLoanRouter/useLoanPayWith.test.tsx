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
const mockPushModal = jest.fn<
  void,
  [unknown, { params: { onSelect: (token: ISwapToken) => void } }]
>();

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
    },
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
jest.mock('../EarnRouter/EarnRouterPayWith', () => ({
  refreshPickedPayToken: jest.fn(),
  rememberPickedPayToken: jest.fn(),
  usePayTokens: () => ({
    heldTokens: mockHeldTokens,
    tokens: [...mockHeldTokens, oldPick],
    isLoaded: true,
  }),
}));
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
it('disables bridge funding when a cached choice belongs to the previous wallet', async () => {
  const walletA = { accountId: '', indexedAccountId: 'wallet-a' };
  const walletB = { accountId: '', indexedAccountId: 'wallet-b' };
  const sourceB = Promise.withResolvers<string>();
  const resolveAccount = jest.mocked(getLoanNetworkAccountId);
  resolveAccount.mockImplementation(async ({ account }) =>
    account.indexedAccountId === walletA.indexedAccountId
      ? 'source-a'
      : sourceB.promise,
  );
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

  await act(async () => sourceB.resolve('source-b'));
  expect(resolveAccount).toHaveBeenCalledWith({
    account: walletB,
    networkId: sourceNetworkId,
  });
  expect(view.result.current.canSwap).toBe(false);
  expect(view.result.current.fundingKey).toBe('');

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
