/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { buildDeferredPromise } from '@onekeyhq/components';
import type { IMarketSelectedDeriveType } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketDeriveType';

import { useNetworkAccount } from './useNetworkAccount';

type ITestAccount = { id: string; address: string; xpub?: string };
let mockActiveAccount: {
  account?: { id: string };
  indexedAccount?: { id: string };
} = {};
let mockSelectedDeriveType: IMarketSelectedDeriveType | undefined;
const mockGetNetworkAccount = jest.fn<
  Promise<ITestAccount | undefined>,
  [unknown]
>();
const mockGetDeriveType = jest.fn(async (_params: unknown) => 'default');

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: (params: unknown) =>
        mockGetDeriveType(params),
    },
    serviceAccount: {
      getNetworkAccount: (params: unknown) => mockGetNetworkAccount(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useSelectedDeriveTypeAtom: () => [mockSelectedDeriveType],
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const deferred = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useNetInfo: () => ({ isRawInternetReachable: true }),
    useDeferredPromise: deferred.useDeferredPromise,
    buildDeferredPromise: deferred.buildDeferredPromise,
  };
});

describe('useNetworkAccount identity isolation', () => {
  const accountA = { id: 'account-a', address: 'address-a', xpub: 'xpub-a' };
  const accountB = { id: 'account-b', address: 'address-b', xpub: 'xpub-b' };

  beforeEach(() => {
    mockActiveAccount = { account: { id: accountA.id } };
    mockSelectedDeriveType = undefined;
    mockGetNetworkAccount.mockReset();
    mockGetNetworkAccount.mockResolvedValue(accountA);
    mockGetDeriveType.mockClear();
  });

  it.each(['account', 'indexedAccount', 'network', 'deriveType'] as const)(
    'hides the previous account in the first render after a %s change',
    async (identity) => {
      const renders: ReturnType<typeof useNetworkAccount>[] = [];
      const { result, rerender } = renderHook(
        ({ networkId }) => {
          const value = useNetworkAccount(networkId);
          renders.push(value);
          return value;
        },
        { initialProps: { networkId: 'btc--0' } },
      );
      await waitFor(() =>
        expect(result.current.accountAddress).toBe('address-a'),
      );

      const pending = buildDeferredPromise<ITestAccount>();
      mockGetNetworkAccount.mockReturnValue(pending.promise);
      if (identity === 'account') {
        mockActiveAccount = { account: { id: accountB.id } };
      } else if (identity === 'indexedAccount') {
        mockActiveAccount = { indexedAccount: { id: 'indexed-b' } };
      } else if (identity === 'deriveType') {
        mockSelectedDeriveType = {
          networkId: 'btc--0',
          deriveType: 'BIP44',
        };
      }
      renders.length = 0;
      rerender({ networkId: identity === 'network' ? 'evm--1' : 'btc--0' });
      expect(renders[0]).toEqual({
        networkAccount: undefined,
        accountAddress: undefined,
        xpub: undefined,
      });
      expect(result.current.accountAddress).toBeUndefined();

      await act(async () => pending.resolve(accountB));
      await waitFor(() =>
        expect(result.current.accountAddress).toBe('address-b'),
      );
      expect(result.current.xpub).toBe('xpub-b');
    },
  );

  it('ignores an old lookup that resolves while the new account lookup is pending', async () => {
    const oldLookup = buildDeferredPromise<ITestAccount>();
    const newLookup = buildDeferredPromise<ITestAccount>();
    mockGetNetworkAccount.mockReturnValueOnce(oldLookup.promise);
    const { result, rerender } = renderHook(() =>
      useNetworkAccount('sol--101'),
    );
    await waitFor(() => expect(mockGetNetworkAccount).toHaveBeenCalledTimes(1));
    mockGetNetworkAccount.mockReturnValue(newLookup.promise);
    mockActiveAccount = { account: { id: accountB.id } };
    rerender();
    await waitFor(() => expect(mockGetNetworkAccount).toHaveBeenCalledTimes(2));
    await act(async () => oldLookup.resolve(accountA));
    expect(result.current.accountAddress).toBeUndefined();
    await act(async () => newLookup.resolve(accountB));
    expect(result.current.accountAddress).toBe('address-b');
  });
});
