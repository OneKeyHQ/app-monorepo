/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import { settingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapActions } from './actions';
import {
  ProviderJotaiContextSwap,
  swapAlertsAtom,
  swapNetworks,
  swapSelectFromTokenAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
} from './atoms';

type IFetchSwapTokenDetailsParams = {
  networkId: string;
  accountAddress?: string;
  accountId?: string;
  contractAddress: string;
  currency?: string;
  direction?: ESwapDirectionType;
};
type ISwapAddressInfo = ReturnType<typeof useSwapAddressInfo>;

const mockFetchSwapTokenDetails: jest.MockedFunction<
  (
    params: IFetchSwapTokenDetailsParams,
  ) => Promise<{ balanceParsed?: string; price?: string; fiatValue?: string }[]>
> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
    },
  },
}));

const ethToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};
const evmSwapNetwork: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
};
const evmAccount: INetworkAccount = {
  id: 'hd-1--m/44/60/0/0/0',
  name: 'Account 1',
  type: undefined,
  path: "m/44'/60'/0'/0/0",
  coinType: '60',
  impl: 'evm',
  pub: '',
  address: '0xabc',
  addressDetail: {
    isValid: true,
    networkId: 'evm--1',
    address: '0xabc',
    baseAddress: '0xabc',
    normalizedAddress: '0xabc',
    displayAddress: '0xabc',
    allowEmptyAddress: false,
  },
};
const activeAccountInfo: IAccountSelectorActiveAccountInfo = {
  ready: true,
  account: evmAccount,
  indexedAccount: undefined,
  dbAccount: undefined,
  accountName: 'Account 1',
  wallet: undefined,
  device: undefined,
  network: undefined,
  vaultSettings: undefined,
  deriveType: undefined,
  deriveInfoItems: [],
};
const fromAddressInfo: ISwapAddressInfo = {
  address: '0xabc',
  networkId: 'evm--1',
  accountInfo: activeAccountInfo,
  activeAccount: activeAccountInfo,
  isAddressInfoReady: true,
};

function createWrapperWithStore() {
  const store = createStore();
  store.set(swapSelectFromTokenAtom(), ethToken);

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
  }

  return { store, Wrapper };
}

function createWrapper() {
  return createWrapperWithStore().Wrapper;
}

describe('useSwapActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(settingsAtom, 'get').mockResolvedValue({
      swapEnableRecipientAddress: false,
      swapIncognitoMode: false,
      swapSlippagePercentageCustomValue: 0,
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.AUTO,
      swapToAnotherAccountSwitchOn: false,
    });
  });

  it('pins selected token detail price fetches to USD for rate-difference math', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue([
      {
        balanceParsed: '1.23',
        price: '3000',
        fiatValue: '3690',
      },
    ]);

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [fromToken] = useSwapSelectFromTokenAtom();
        const [balance] = useSwapSelectedFromTokenBalanceAtom();

        return {
          actions,
          fromToken,
          balance,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        fromAddressInfo,
      );
    });

    expect(mockFetchSwapTokenDetails).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountAddress: '0xabc',
      accountId: 'hd-1--m/44/60/0/0/0',
      contractAddress: '',
      direction: ESwapDirectionType.FROM,
      currency: 'usd',
    });
    expect(result.current.fromToken?.price).toBe('3000');
    expect(result.current.fromToken?.currency).toBe('usd');
    expect(result.current.balance).toBe('1.23');
  });

  it('does not keep noConnectWallet warning when native wallet readiness is not proven', async () => {
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapNetworks(), [evmSwapNetwork]);
    store.set(swapAlertsAtom(), {
      states: [{ message: 'keep me' }, { noConnectWallet: true }],
      quoteId: 'old-quote',
    });

    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.checkSwapWarning(fromAddressInfo, fromAddressInfo, {
        allowNoConnectWallet: false,
      });
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([
      { message: 'keep me' },
    ]);
  });

  it('keeps noConnectWallet warning when the caller proves a real no-wallet state', async () => {
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapNetworks(), [evmSwapNetwork]);

    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.checkSwapWarning(fromAddressInfo, fromAddressInfo, {
        allowNoConnectWallet: true,
      });
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([
      { noConnectWallet: true },
    ]);
  });
});
