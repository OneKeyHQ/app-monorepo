/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react-native';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { buildAllEnabledNetworkCustomNetworks } from '../components/AccountSelector/buildAllEnabledNetworkCustomNetworks';

import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from './useAllNetwork';

import type backgroundApiProxy from '../background/instance/backgroundApiProxy';

type ICompatibilityMethod =
  typeof backgroundApiProxy.serviceAllNetwork.getEnabledNetworksAccountCompatibility;
const mockCompatibility = jest.fn<
  ReturnType<ICompatibilityMethod>,
  Parameters<ICompatibilityMethod>
>();

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAllNetwork: {
      getEnabledNetworksAccountCompatibility: (
        ...args: Parameters<ICompatibilityMethod>
      ) => mockCompatibility(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({}));
jest.mock('./useRouteIsFocused', () => ({}));
jest.mock('./usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<unknown>,
    _dependencies: unknown[],
    { initResult }: { initResult: unknown },
  ) => ({ run: method, result: initResult }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: ({ networkId }: { networkId?: string }) =>
      networkId === 'onekeyall--0',
  },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrKeys: { allNetworksCompatible: () => 'fixture-swr-key' },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: class extends Error {},
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/shared/src/performance/mark', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/debug/perfUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: jest.fn(async () => undefined) },
}));
jest.mock('../components/TokenListView/perfTokenListView', () => ({}));

const emptyResult = {
  compatibleNetworks: [],
  compatibleNetworksWithoutAccount: [],
  networkInfoMap: {},
};
beforeEach(() => {
  jest.clearAllMocks();
  mockCompatibility.mockResolvedValue(emptyResult);
});

describe('main delegates account compatibility to bg', () => {
  it('passes only network IDs and filtering flags through one RPC', async () => {
    const enabledNetworks = [{ id: 'evm--1', impl: 'evm' } as IServerNetwork];
    const { result } = renderHook(() =>
      useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
        walletId: 'fixture-wallet',
        networkId: 'onekeyall--0',
        indexedAccountId: 'fixture-index',
        filterNetworksWithoutAccount: true,
        withNetworksInfo: true,
        enabledNetworks,
        deferMs: 10,
      }),
    );
    await result.current.run();
    expect(timerUtils.wait).toHaveBeenCalledWith(10);
    expect(mockCompatibility).toHaveBeenCalledTimes(1);
    expect(mockCompatibility).toHaveBeenCalledWith({
      walletId: 'fixture-wallet',
      enabledNetworkIds: ['evm--1'],
      indexedAccountId: 'fixture-index',
      filterNetworksWithoutAccount: true,
      withNetworksInfo: true,
    });
  });

  it.each([
    { walletId: '' },
    { walletId: 'fixture-wallet', networkId: 'evm--1' },
    { walletId: 'fixture-wallet', enabledNetworks: [] },
  ])('preserves local empty/single-network guards: %j', async (params) => {
    const { result } = renderHook(() =>
      useEnabledNetworksCompatibleWithWalletIdInAllNetworks(params),
    );
    await result.current.run();
    expect(mockCompatibility).not.toHaveBeenCalled();
  });

  it('preserves the creation helper network and derive array shape', async () => {
    const evm = { id: 'evm--1' } as IServerNetwork;
    const btc = { id: 'btc--0' } as IServerNetwork;
    mockCompatibility.mockResolvedValue({
      compatibleNetworks: [evm, btc],
      compatibleNetworksWithoutAccount: [btc],
      networkInfoMap: {
        'evm--1': { deriveType: 'default', mergeDeriveAssetsEnabled: false },
        'btc--0': { deriveType: 'default', mergeDeriveAssetsEnabled: true },
      },
    });
    await expect(
      buildAllEnabledNetworkCustomNetworks({
        walletId: 'fixture-wallet',
        networkId: 'onekeyall--0',
        indexedAccountId: 'fixture-index',
      }),
    ).resolves.toEqual([{ networkId: 'btc--0', deriveType: 'default' }]);
    expect(mockCompatibility).toHaveBeenCalledWith({
      walletId: 'fixture-wallet',
      indexedAccountId: 'fixture-index',
      filterNetworksWithoutAccount: true,
      withNetworksInfo: true,
    });
  });

  it('returns no creation entries when no network needs an account', async () => {
    await expect(
      buildAllEnabledNetworkCustomNetworks({
        walletId: 'fixture-wallet',
        networkId: 'onekeyall--0',
        indexedAccountId: 'fixture-index',
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    {
      walletId: undefined,
      networkId: 'onekeyall--0',
      indexedAccountId: 'index',
    },
    { walletId: 'wallet', networkId: undefined, indexedAccountId: 'index' },
    {
      walletId: 'wallet',
      networkId: 'onekeyall--0',
      indexedAccountId: undefined,
    },
    { walletId: 'wallet', networkId: 'evm--1', indexedAccountId: 'index' },
  ])('does not dispatch invalid creation scopes: %j', async (params) => {
    await expect(buildAllEnabledNetworkCustomNetworks(params)).resolves.toEqual(
      [],
    );
    expect(mockCompatibility).not.toHaveBeenCalled();
  });
});
