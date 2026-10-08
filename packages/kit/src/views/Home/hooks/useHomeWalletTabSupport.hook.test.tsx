/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// Polyfill requestIdleCallback/cancelIdleCallback for non-native environments
if (typeof globalThis.requestIdleCallback === 'undefined') {
  (globalThis as any).requestIdleCallback = (cb: () => void) =>
    setTimeout(cb, 0);
  (globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}

import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isDesktop: false,
    isWeb: true,
    isRuntimeBrowser: true,
    isRuntimeChrome: false,
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const deferredPromiseModule = require('../../../../../components/src/hooks/useDeferredPromise');
  const netInfoModule = require('../../../../../components/src/hooks/useNetInfo');
  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: deferredPromiseModule.useDeferredPromise,
    useNetInfo: netInfoModule.useNetInfo,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => ({ perpDisabled: false }),
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    EnabledNetworksChanged: 'EnabledNetworksChanged',
    DeFiEnabledNetworksChanged: 'DeFiEnabledNetworksChanged',
  },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

const mockGetDeFiEnabledNetworksMap: jest.Mock<
  Promise<Record<string, boolean>>,
  unknown[]
> = jest.fn();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDeFi: {
      getDeFiEnabledNetworksMap: (...args: unknown[]) =>
        mockGetDeFiEnabledNetworksMap(...args),
    },
    serviceAllNetwork: { getAllNetworksState: jest.fn() },
    serviceNetwork: { getAllNetworks: jest.fn() },
  },
}));

import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { useHomeWalletTabSupport } from './useHomeWalletTabSupport';

const evmNetwork = { id: 'evm--1', isAllNetworks: false, isTestnet: false };
const evmScopeKey = 'evm--1:single:perp-enabled';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useHomeWalletTabSupport cold start (OK-61505)', () => {
  beforeEach(() => {
    swrCacheUtils.clearAll();
    mockGetDeFiEnabledNetworksMap.mockReset();
  });

  it('renders the persisted tab support before the background call resolves', () => {
    swrCacheUtils.set(swrKeys.homeWalletTabSupport({ scopeKey: evmScopeKey }), {
      scopeKey: evmScopeKey,
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
    mockGetDeFiEnabledNetworksMap.mockReturnValue(
      createDeferred<Record<string, boolean>>().promise,
    );

    const { result } = renderHook(() =>
      useHomeWalletTabSupport({ network: evmNetwork }),
    );

    expect(result.current.isReady).toBe(true);
    expect(result.current.isDeFiSupported).toBe(true);
    expect(result.current.isPerpsSupported).toBe(true);
  });

  it('starts from init without a snapshot and persists the resolved support', async () => {
    const deferred = createDeferred<Record<string, boolean>>();
    mockGetDeFiEnabledNetworksMap.mockReturnValue(deferred.promise);

    const { result } = renderHook(() =>
      useHomeWalletTabSupport({ network: evmNetwork }),
    );

    expect(result.current.isReady).toBe(false);
    expect(result.current.isDeFiSupported).toBe(false);

    await act(async () => {
      deferred.resolve({ 'evm--1': true });
      await deferred.promise;
    });

    await waitFor(() => {
      expect(result.current.isDeFiSupported).toBe(true);
    });
    expect(
      swrCacheUtils.get(
        swrKeys.homeWalletTabSupport({ scopeKey: evmScopeKey }),
      ),
    ).toEqual({
      scopeKey: evmScopeKey,
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
  });

  it('does not persist the placeholder produced while no network is selected', async () => {
    const { result } = renderHook(() =>
      useHomeWalletTabSupport({ network: undefined }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(mockGetDeFiEnabledNetworksMap).not.toHaveBeenCalled();
    expect(swrCacheUtils.get(':single:perp-enabled')).toBeUndefined();
  });
});
