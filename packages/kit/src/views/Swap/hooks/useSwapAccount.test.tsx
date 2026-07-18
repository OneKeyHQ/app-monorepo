/** @jest-environment jsdom */

import React from 'react';

import { act, render, waitFor } from '@testing-library/react';

import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from './useSwapAccount';

const mockGetGlobalDeriveTypeOfNetwork = jest.fn<
  Promise<string>,
  [{ networkId: string }]
>();
const mockGetNetworkAccount = jest.fn<
  Promise<INetworkAccount>,
  [Record<string, unknown>]
>();
const mockTabFocusCallbacks = new Set<
  (isFocus: boolean, isHideByModal: boolean) => void
>();

const fromToken: ISwapToken = {
  contractAddress: '0xfrom',
  decimals: 18,
  networkId: 'evm--1',
  symbol: 'FROM',
};

const targetNetworkAccount = {
  addressDetail: { address: '0xtarget' },
  id: 'account-evm-1',
} as INetworkAccount;

const mockActiveAccount = {
  account: undefined,
  dbAccount: undefined,
  deriveType: 'default',
  indexedAccount: { id: 'indexed-1' },
  network: { id: 'onekeyall--0' },
  ready: true,
};

jest.mock('@onekeyhq/components', () => ({
  useIsOverlayPage: () => false,
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsAtom: () => [{ swapToAnotherAccountSwitchOn: false }, jest.fn()],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getNetworkAccount: (params: Record<string, unknown>) =>
        mockGetNetworkAccount(params),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: (params: { networkId: string }) =>
        mockGetGlobalDeriveTypeOfNetwork(params),
    },
  },
}));

jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: function useMockListenTabFocusState(
    _tab: unknown,
    callback: (isFocus: boolean, isHideByModal: boolean) => void,
  ) {
    const callbackRef = React.useRef(callback);
    callbackRef.current = callback;
    React.useEffect(() => {
      const listener = (isFocus: boolean, isHideByModal: boolean) =>
        callbackRef.current(isFocus, isHideByModal);
      mockTabFocusCallbacks.add(listener);
      return () => {
        mockTabFocusCallbacks.delete(listener);
      };
    }, []);
  },
}));

jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({}),
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({
    current: { updateSelectedAccountNetwork: jest.fn() },
  }),
}));

jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapFromTokenAmountAtom: () => [{}],
  useSwapProDirectionAtom: () => ['sell'],
  useSwapProSelectTokenAtom: () => [undefined],
  useSwapProSellToTokenAtom: () => [undefined],
  useSwapProUseSelectBuyTokenAtom: () => [undefined],
  useSwapProviderSupportReceiveAddressAtom: () => [false],
  useSwapSelectFromTokenAtom: () => [fromToken],
  useSwapSelectedTokensColdStartContextAtom: () => [undefined],
  useSwapSelectTokenNetworkAtom: () => [undefined],
  useSwapSelectToTokenAtom: () => [undefined],
  useSwapToAnotherAccountAddressAtom: () => [{}],
  useSwapToTokenAmountAtom: () => [{}],
  useSwapTypeSwitchAtom: () => [ESwapTabSwitchType.SWAP],
}));

function AddressConsumer({ index }: { index: number }) {
  const addressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  return (
    <output data-testid={`address-${index}`}>
      {`${addressInfo.address ?? ''}|${String(addressInfo.isAddressInfoReady)}`}
    </output>
  );
}

function FirstMobileSwapAddressConsumers() {
  // The ordinary mobile Swap mount has at least 16 address-info consumers
  // across SwapMainLoad, build/init/quote/actions, both inputs, and the header.
  return (
    <>
      {Array.from({ length: 16 }, (_, index) => (
        <AddressConsumer index={index} key={index} />
      ))}
    </>
  );
}

function createDeferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return {
    promise,
    resolve: (value: T) => resolve?.(value),
  };
}

describe('useSwapAddressInfo target-network resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabFocusCallbacks.clear();
  });

  it('coalesces the first mobile Swap consumer lower bound into one ordered RPC chain', async () => {
    const deriveTypeRequest = createDeferred<string>();
    const accountRequest = createDeferred<INetworkAccount>();
    mockGetGlobalDeriveTypeOfNetwork.mockReturnValue(deriveTypeRequest.promise);
    mockGetNetworkAccount.mockReturnValue(accountRequest.promise);

    const view = render(<FirstMobileSwapAddressConsumers />);

    expect(mockGetGlobalDeriveTypeOfNetwork).toHaveBeenCalledTimes(1);
    expect(mockGetNetworkAccount).not.toHaveBeenCalled();

    await act(async () => {
      deriveTypeRequest.resolve('default');
      await deriveTypeRequest.promise;
    });
    await waitFor(() => {
      expect(mockGetNetworkAccount).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      accountRequest.resolve(targetNetworkAccount);
      await accountRequest.promise;
    });
    await waitFor(() => {
      expect(view.getAllByText('0xtarget|true', { exact: true })).toHaveLength(
        16,
      );
    });

    expect(mockGetGlobalDeriveTypeOfNetwork).toHaveBeenCalledWith({
      networkId: 'evm--1',
    });
    expect(mockGetNetworkAccount).toHaveBeenCalledWith({
      accountId: undefined,
      dbAccount: undefined,
      deriveType: 'default',
      indexedAccountId: 'indexed-1',
      networkId: 'evm--1',
    });
  });

  it('retries one coalesced chain after a failed owner regains Swap focus', async () => {
    mockGetGlobalDeriveTypeOfNetwork.mockResolvedValue('default');
    mockGetNetworkAccount
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(targetNetworkAccount);

    const view = render(<FirstMobileSwapAddressConsumers />);

    await waitFor(() => {
      expect(mockGetNetworkAccount).toHaveBeenCalledTimes(1);
      expect(view.getAllByText('|false', { exact: true })).toHaveLength(16);
    });

    act(() => {
      mockTabFocusCallbacks.forEach((callback) => callback(true, false));
    });

    await waitFor(() => {
      expect(mockGetGlobalDeriveTypeOfNetwork).toHaveBeenCalledTimes(2);
      expect(mockGetNetworkAccount).toHaveBeenCalledTimes(2);
      expect(view.getAllByText('0xtarget|true', { exact: true })).toHaveLength(
        16,
      );
    });
  });

  it('retries one coalesced chain when the already-focused first request fails', async () => {
    mockGetGlobalDeriveTypeOfNetwork.mockResolvedValue('default');
    mockGetNetworkAccount
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(targetNetworkAccount);

    const view = render(<FirstMobileSwapAddressConsumers />);

    await waitFor(
      () => {
        expect(mockGetGlobalDeriveTypeOfNetwork).toHaveBeenCalledTimes(2);
        expect(mockGetNetworkAccount).toHaveBeenCalledTimes(2);
        expect(
          view.getAllByText('0xtarget|true', { exact: true }),
        ).toHaveLength(16);
      },
      { timeout: 3000 },
    );
  });
});
