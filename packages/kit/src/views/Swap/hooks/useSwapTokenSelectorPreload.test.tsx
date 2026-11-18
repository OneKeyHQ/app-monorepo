/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ESwapTabSwitchType,
  type ISwapNetwork,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapTokenSelectorPreload } from './useSwapTokenSelectorPreload';

type IPreloadParams = Parameters<typeof useSwapTokenSelectorPreload>[0];

const mockLoadAllNetworks = jest.fn<Promise<void>, unknown[]>();
let mockGtMd = true;
const mockActions = {
  current: { swapLoadAllNetworkTokenList: mockLoadAllNetworks },
};

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => mockActions,
}));
jest.mock('@onekeyhq/components', () => ({
  useMedia: () => ({ gtMd: mockGtMd }),
}));

const initialPlatform = {
  isDesktop: platformEnv.isDesktop,
  isWeb: platformEnv.isWeb,
  isExtension: platformEnv.isExtension,
};
const ethereum: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
  supportSingleSwap: true,
  supportLimit: true,
  supportStock: false,
  backendIndex: true,
  isDeFiEnabled: true,
};
const arbitrum: ISwapNetwork = {
  ...ethereum,
  networkId: 'evm--42161',
  name: 'Arbitrum',
};

function addressInfo(
  id = 'indexed-account-1',
  indexed = true,
): IPreloadParams['fromAddressInfo'] {
  return {
    isAddressInfoReady: true,
    accountInfo: {
      ready: true,
      indexedAccount: indexed
        ? { id, name: id, walletId: 'wallet-1', index: 0, idHash: id }
        : undefined,
      dbAccount: indexed
        ? undefined
        : {
            id,
            name: id,
            type: undefined,
            path: '',
            coinType: '60',
            impl: 'evm',
            pub: '',
            address: '0xaccount',
          },
      account: undefined,
      accountName: id,
      wallet: undefined,
      device: undefined,
      network: undefined,
      vaultSettings: undefined,
      deriveType: undefined,
      deriveInfoItems: [],
    },
  };
}

function preloadParams(): IPreloadParams {
  return {
    enabled: true,
    fromAddressInfo: addressInfo(),
    toAddressInfo: addressInfo(),
    networks: [ethereum, arbitrum],
    swapType: ESwapTabSwitchType.SWAP,
    currency: 'usd',
  };
}

describe('useSwapTokenSelectorPreload', () => {
  beforeEach(() => {
    platformEnv.isDesktop = true;
    platformEnv.isWeb = false;
    platformEnv.isExtension = false;
    mockGtMd = true;
    mockLoadAllNetworks.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.assign(platformEnv, initialPlatform);
  });

  it('loads a shared FROM/TO wallet once before the selector opens', () => {
    renderHook(useSwapTokenSelectorPreload, { initialProps: preloadParams() });

    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
    expect(mockLoadAllNetworks).toHaveBeenCalledWith(
      'indexed-account-1',
      undefined,
      false,
      'usd',
      { policy: 'preload', fullChainLists: true },
    );
  });

  it('preloads distinct recipient wallets using the same account scope as the modal', () => {
    const params = preloadParams();
    params.toAddressInfo = addressInfo('imported-account-2', false);
    renderHook(useSwapTokenSelectorPreload, { initialProps: params });

    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(2);
    expect(mockLoadAllNetworks).toHaveBeenNthCalledWith(
      2,
      undefined,
      'imported-account-2',
      false,
      'usd',
      { policy: 'preload', fullChainLists: true },
    );
  });

  it('waits for network metadata and the new account resolution instead of using a retained account', () => {
    const params = preloadParams();
    const pendingAddressInfo = {
      ...addressInfo('new-account'),
      isAddressInfoReady: false,
    };
    const initialProps: IPreloadParams = { ...params, networks: [] };
    const { rerender } = renderHook(useSwapTokenSelectorPreload, {
      initialProps,
    });
    expect(mockLoadAllNetworks).not.toHaveBeenCalled();

    rerender({
      ...params,
      networks: [{ ...ethereum, supportSingleSwap: undefined }],
    });
    expect(mockLoadAllNetworks).not.toHaveBeenCalled();

    rerender({
      ...params,
      fromAddressInfo: pendingAddressInfo,
      toAddressInfo: pendingAddressInfo,
    });
    expect(mockLoadAllNetworks).not.toHaveBeenCalled();

    rerender({
      ...params,
      fromAddressInfo: addressInfo('new-account'),
      toAddressInfo: addressInfo('new-account'),
    });
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
    expect(mockLoadAllNetworks.mock.calls[0][0]).toBe('new-account');
  });

  it('ignores object replacement and network reordering for an unchanged scope', () => {
    const params = preloadParams();
    const { rerender } = renderHook(useSwapTokenSelectorPreload, {
      initialProps: params,
    });
    rerender({ ...preloadParams(), networks: [arbitrum, ethereum] });

    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
  });

  it('preloads ordinary lists when basic networks are ready without DeFi metadata', () => {
    renderHook(useSwapTokenSelectorPreload, {
      initialProps: {
        ...preloadParams(),
        networks: [{ ...ethereum, isDeFiEnabled: undefined }],
      },
    });
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
  });

  it('does not rewarm a deleted owner retained by selection while the next owner resolves', () => {
    const params = {
      ...preloadParams(),
      fromAddressInfo: addressInfo('removed-preload-owner'),
      toAddressInfo: addressInfo('removed-preload-owner'),
    };
    const { rerender } = renderHook(useSwapTokenSelectorPreload, {
      initialProps: params,
    });
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
    act(() => {
      appEventBus.emit(EAppEventBusNames.AccountRemove, {
        indexedAccountId: 'removed-preload-owner',
      });
    });
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
    rerender({
      ...params,
      fromAddressInfo: addressInfo('next-preload-owner'),
      toAddressInfo: addressInfo('next-preload-owner'),
    });
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(2);
    expect(mockLoadAllNetworks.mock.calls[1][0]).toBe('next-preload-owner');
  });

  it('defers invalidated data while hidden and loads only the current wallet on activation', () => {
    const params = preloadParams();
    const { rerender } = renderHook(useSwapTokenSelectorPreload, {
      initialProps: { ...params, enabled: false },
    });
    act(() => {
      appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
        networkImpl: 'btc',
      });
    });
    expect(mockLoadAllNetworks).not.toHaveBeenCalled();

    rerender({
      ...params,
      fromAddressInfo: addressInfo('latest-account'),
      toAddressInfo: addressInfo('latest-account'),
    });
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
    expect(mockLoadAllNetworks.mock.calls[0][0]).toBe('latest-account');
  });

  it('rechecks the loader on invalidation, currency and protocol changes', () => {
    const params = preloadParams();
    const { rerender } = renderHook(useSwapTokenSelectorPreload, {
      initialProps: params,
    });
    act(() => {
      appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
        networkImpl: 'btc',
      });
    });
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(2);

    rerender({ ...params, currency: 'eur' });
    expect(mockLoadAllNetworks).toHaveBeenLastCalledWith(
      'indexed-account-1',
      undefined,
      false,
      'eur',
      { policy: 'preload', fullChainLists: true },
    );
    rerender({
      ...params,
      currency: 'eur',
      swapType: ESwapTabSwitchType.BRIDGE,
    });
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(4);
  });

  it.each(['native', 'stock'] as const)(
    'does not preload %s selectors',
    (target) => {
      const params = preloadParams();
      if (target === 'native') {
        platformEnv.isDesktop = false;
        platformEnv.isWeb = false;
      } else {
        params.swapType = ESwapTabSwitchType.STOCK;
      }
      renderHook(useSwapTokenSelectorPreload, { initialProps: params });

      expect(mockLoadAllNetworks).not.toHaveBeenCalled();
    },
  );

  it.each([
    { gtMd: true, protocol: ESwapTabSwitchType.SWAP, expected: 1 },
    { gtMd: false, protocol: ESwapTabSwitchType.SWAP, expected: 0 },
    { gtMd: true, protocol: ESwapTabSwitchType.STOCK, expected: 0 },
  ])(
    'preloads extension only when wide and non-stock ($gtMd, $protocol)',
    ({ gtMd, protocol, expected }) => {
      platformEnv.isDesktop = false;
      platformEnv.isExtension = true;
      mockGtMd = gtMd;
      renderHook(useSwapTokenSelectorPreload, {
        initialProps: { ...preloadParams(), swapType: protocol },
      });
      expect(mockLoadAllNetworks).toHaveBeenCalledTimes(expected);
    },
  );

  it('starts extension preload when its viewport becomes wide', () => {
    platformEnv.isDesktop = false;
    platformEnv.isExtension = true;
    mockGtMd = false;
    const { rerender } = renderHook(useSwapTokenSelectorPreload, {
      initialProps: preloadParams(),
    });
    expect(mockLoadAllNetworks).not.toHaveBeenCalled();
    mockGtMd = true;
    rerender(preloadParams());
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
  });

  it.each(['desktop', 'web'] as const)(
    'does not repeat %s preload across viewport breakpoints',
    (platform) => {
      platformEnv.isDesktop = platform === 'desktop';
      platformEnv.isWeb = platform === 'web';
      const { rerender } = renderHook(useSwapTokenSelectorPreload, {
        initialProps: preloadParams(),
      });
      expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
      mockGtMd = false;
      rerender(preloadParams());
      mockGtMd = true;
      rerender(preloadParams());
      expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
    },
  );
});
