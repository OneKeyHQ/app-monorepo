/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const real = jest.requireActual('@onekeyhq/shared/src/platformEnv');
  const realEnv = real?.default ?? real;
  return {
    __esModule: true,
    default: {
      ...realEnv,
      isNative: false,
      isDesktop: false,
      isWeb: true,
      isRuntimeBrowser: true,
    },
  };
});

jest.mock('@onekeyhq/components', () => {
  const ReactModule = require('react') as typeof import('react');
  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: () =>
      ReactModule.useMemo(
        () => ({
          promise: Promise.resolve(),
          resolve: () => {},
          reset: () => {},
        }),
        [],
      ),
    useNetInfo: () => ({ isRawInternetReachable: null }),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => {
  const ReactModule = require('react') as typeof import('react');
  let currentFocus = true;
  const listeners = new Set<(focused: boolean) => void>();
  const control = {
    setFocus(focused: boolean) {
      currentFocus = focused;
      listeners.forEach((listener) => listener(focused));
    },
    reset() {
      currentFocus = true;
      listeners.clear();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
  (globalThis as any).__homeTabSupportFocusControl = control;
  return {
    useRouteIsFocused: () => {
      const [focused, setFocused] = ReactModule.useState(currentFocus);
      ReactModule.useEffect(() => {
        listeners.add(setFocused);
        return () => {
          listeners.delete(setFocused);
        };
      }, []);
      return focused;
    },
  };
});

jest.mock('@onekeyhq/kit/src/hooks/usePerpTabConfig', () => {
  const state = { perpDisabled: false, perpTabShowWeb: false };
  (globalThis as any).__homeTabSupportPerpConfig = state;
  return { usePerpTabConfig: () => state };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCommonConfigPersistAtom: () => [{ perpConfigLoaded: true }],
}));

jest.mock('../model/react/homeStoreHooks', () => ({
  useHomeFactsSnapshot: () =>
    (
      globalThis as typeof globalThis & {
        __homeTabSupportStoreFacts: unknown;
      }
    ).__homeTabSupportStoreFacts,
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => {
  const state = {
    activeAccount: {
      account: { id: 'account-1' },
      indexedAccount: { id: 'indexed-1' },
      wallet: { id: 'wallet-1' },
    },
  };
  (globalThis as any).__homeTabSupportActiveAccount = state;
  return { useActiveAccount: () => state };
});

jest.mock('../../../background/instance/backgroundApiProxy', () => {
  const getDeFiEnabledNetworksMapState = jest.fn();
  (globalThis as any).__homeTabSupportGetState = getDeFiEnabledNetworksMapState;
  return {
    __esModule: true,
    default: { serviceDeFi: { getDeFiEnabledNetworksMapState } },
  };
});

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const listeners = new Set<() => void>();
  const eventName = 'EnabledNetworksChanged';
  const appEventBus = {
    on: jest.fn((name: string, listener: () => void) => {
      if (name === eventName) listeners.add(listener);
    }),
    off: jest.fn((name: string, listener: () => void) => {
      if (name === eventName) listeners.delete(listener);
    }),
    emit: jest.fn((name: string) => {
      if (name === eventName) {
        [...listeners].forEach((listener) => listener());
      }
    }),
  };
  (globalThis as any).__homeTabSupportEventBus = appEventBus;
  (globalThis as any).__homeTabSupportEventListeners = listeners;
  return {
    EAppEventBusNames: { EnabledNetworksChanged: eventName },
    appEventBus,
  };
});

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import {
  HOME_WALLET_TAB_SUPPORT_INIT,
  buildHomeWalletTabSupport,
  buildHomeWalletTabSupportScopeKey,
  hasDeFiSupportedEnabledNetwork,
  resolveHomeWalletTabSupportAccountScopeId,
} from './homeWalletTabSupportUtils';
import {
  HOME_WALLET_TAB_SUPPORT_MAX_AUTO_RETRIES,
  HOME_WALLET_TAB_SUPPORT_RETRY_DELAY_MS,
  useHomeWalletTabSupport,
} from './useHomeWalletTabSupport';

type IEnabledNetworksMapState = {
  enabledNetworksMap: Record<string, boolean>;
  isReady: boolean;
};

type ITestGlobals = typeof globalThis & {
  __homeTabSupportActiveAccount: {
    activeAccount: {
      account?: { id: string };
      indexedAccount?: { id: string };
      wallet?: { id: string };
    };
  };
  __homeTabSupportEventBus: { emit: jest.Mock; off: jest.Mock; on: jest.Mock };
  __homeTabSupportEventListeners: Set<() => void>;
  __homeTabSupportFocusControl: {
    listenerCount: number;
    reset: () => void;
    setFocus: (focused: boolean) => void;
  };
  __homeTabSupportGetState: jest.Mock<
    Promise<IEnabledNetworksMapState>,
    [{ syncIfEmpty?: boolean }]
  >;
  __homeTabSupportPerpConfig: {
    perpDisabled: boolean;
    perpTabShowWeb: boolean;
  };
  __homeTabSupportStoreFacts: {
    owner: {
      walletId: string;
      accountId: string;
      network:
        | { kind: 'allNetworks' }
        | { kind: 'singleNetwork'; networkId: string };
    };
    ownerToken: { scopeKey: string; sessionId: string };
    wallet: { accountType: 'hd' };
  };
};

const testGlobals = globalThis as ITestGlobals;
const evmNetwork = { id: 'evm--1', isAllNetworks: false, isTestnet: false };
const btcNetwork = { id: 'btc--0', isAllNetworks: false, isTestnet: false };
const allNetworks = {
  id: 'onekeyall--0',
  isAllNetworks: true,
  isTestnet: false,
};

function capabilityMap(
  enabledNetworksMap: Record<string, boolean>,
  isReady = true,
): IEnabledNetworksMapState {
  return { enabledNetworksMap, isReady };
}

function setStoreOwner(networkId: string, isAllNetworks = false) {
  testGlobals.__homeTabSupportStoreFacts = {
    owner: {
      walletId: 'wallet-1',
      accountId: 'account-1',
      network: isAllNetworks
        ? { kind: 'allNetworks' }
        : { kind: 'singleNetwork', networkId },
    },
    ownerToken: {
      scopeKey: `wallet-1:account-1:${networkId}`,
      sessionId: 'session-1',
    },
    wallet: { accountType: 'hd' },
  };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Home wallet tab support policy', () => {
  it('distinguishes supported, unsupported, and unknown capability', () => {
    expect(
      buildHomeWalletTabSupport({
        network: evmNetwork,
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
    expect(
      buildHomeWalletTabSupport({
        network: btcNetwork,
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: false,
      isPerpsSupported: false,
    });
    expect(
      buildHomeWalletTabSupport({
        network: evmNetwork,
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
        isReady: false,
      }),
    ).toEqual(HOME_WALLET_TAB_SUPPORT_INIT);
  });

  it('keeps All Networks available while respecting the Perps kill switch', () => {
    expect(
      buildHomeWalletTabSupport({
        network: allNetworks,
        deFiEnabledNetworksMap: {},
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
    expect(
      buildHomeWalletTabSupport({
        network: allNetworks,
        deFiEnabledNetworksMap: {},
        perpDisabled: true,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: false,
    });
  });

  it('keeps scope and enabled-network identities deterministic', () => {
    expect(
      buildHomeWalletTabSupportScopeKey({
        accountScopeId: 'account-1',
        networkId: 'evm--1',
        isAllNetworks: false,
      }),
    ).not.toBe(
      buildHomeWalletTabSupportScopeKey({
        accountScopeId: 'account-2',
        networkId: 'evm--1',
        isAllNetworks: false,
      }),
    );
    expect(
      resolveHomeWalletTabSupportAccountScopeId({
        indexedAccountId: 'indexed-1',
        accountId: 'account-1',
        walletId: 'wallet-1',
      }),
    ).toBe('indexed-1');
    expect(
      hasDeFiSupportedEnabledNetwork({
        allNetworks: [evmNetwork],
        allNetworksState: {
          enabledNetworks: {},
          disabledNetworks: { 'evm--1': true },
        },
        deFiEnabledNetworksMap: { 'evm--1': true },
      }),
    ).toBe(false);
  });

  it('counts a supported custom network only when explicitly enabled', () => {
    const customNetwork = {
      id: 'evm--999999',
      isAllNetworks: false,
      isTestnet: false,
    };
    expect(
      hasDeFiSupportedEnabledNetwork({
        allNetworks: [customNetwork],
        allNetworksState: { enabledNetworks: {}, disabledNetworks: {} },
        deFiEnabledNetworksMap: { 'evm--999999': true },
      }),
    ).toBe(false);
    expect(
      hasDeFiSupportedEnabledNetwork({
        allNetworks: [customNetwork],
        allNetworksState: {
          enabledNetworks: { 'evm--999999': true },
          disabledNetworks: {},
        },
        deFiEnabledNetworksMap: { 'evm--999999': true },
      }),
    ).toBe(true);
  });
});

describe('useHomeWalletTabSupport', () => {
  beforeEach(() => {
    cleanup();
    jest.useRealTimers();
    testGlobals.__homeTabSupportFocusControl.reset();
    testGlobals.__homeTabSupportEventListeners.clear();
    testGlobals.__homeTabSupportEventBus.emit.mockClear();
    testGlobals.__homeTabSupportEventBus.off.mockClear();
    testGlobals.__homeTabSupportEventBus.on.mockClear();
    testGlobals.__homeTabSupportPerpConfig.perpDisabled = false;
    testGlobals.__homeTabSupportPerpConfig.perpTabShowWeb = false;
    testGlobals.__homeTabSupportActiveAccount.activeAccount = {
      account: { id: 'account-1' },
      indexedAccount: { id: 'indexed-1' },
      wallet: { id: 'wallet-1' },
    };
    setStoreOwner('evm--1');
    testGlobals.__homeTabSupportGetState.mockReset();
    testGlobals.__homeTabSupportGetState.mockResolvedValue(
      capabilityMap({ 'evm--1': true }),
    );
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('returns typed complete capability facts for the current Store owner', async () => {
    const { result } = renderHook(() =>
      useHomeWalletTabSupport({
        network: evmNetwork,
        vaultSettings: { NFTEnabled: false },
      }),
    );

    await waitFor(() => expect(result.current?.resource.kind).toBe('complete'));
    expect(result.current?.resource).toMatchObject({
      context: {
        serverConfig: { defi: 'available' },
        productAvailability: { perps: 'available' },
      },
    });
  });

  it('publishes unknown and transport failure as non-final facts', async () => {
    testGlobals.__homeTabSupportGetState
      .mockResolvedValueOnce(capabilityMap({}, false))
      .mockRejectedValueOnce(new Error('temporary background failure'));
    const { result } = renderHook(() =>
      useHomeWalletTabSupport({
        network: evmNetwork,
        vaultSettings: { NFTEnabled: false },
      }),
    );

    await waitFor(() => expect(result.current?.resource.kind).toBe('loading'));
    act(() => {
      testGlobals.__homeTabSupportEventBus.emit('EnabledNetworksChanged');
    });
    await waitFor(() =>
      expect(result.current?.resource).toEqual({
        kind: 'error',
        errorKind: 'transport',
      }),
    );
  });

  it('does not attribute an out-of-order network result to the next owner', async () => {
    let resolveEvm!: (value: IEnabledNetworksMapState) => void;
    const evmPromise = new Promise<IEnabledNetworksMapState>((resolve) => {
      resolveEvm = resolve;
    });
    testGlobals.__homeTabSupportGetState
      .mockImplementationOnce(() => evmPromise)
      .mockResolvedValueOnce(capabilityMap({ 'evm--1': true }));
    const { result, rerender } = renderHook(
      ({ network }) =>
        useHomeWalletTabSupport({
          network,
          vaultSettings: { NFTEnabled: false },
        }),
      { initialProps: { network: evmNetwork } },
    );

    await waitFor(() =>
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(1),
    );
    setStoreOwner('btc--0');
    rerender({ network: btcNetwork });
    await waitFor(() => expect(result.current?.resource.kind).toBe('complete'));
    expect(result.current?.resource).toMatchObject({
      context: { serverConfig: { defi: 'unavailable' } },
    });

    await act(async () => {
      resolveEvm(capabilityMap({ 'evm--1': true }));
      await evmPromise;
    });
    expect(result.current?.resource).toMatchObject({
      context: { serverConfig: { defi: 'unavailable' } },
    });
  });

  it('retries an unknown capability state a bounded number of times', async () => {
    jest.useFakeTimers();
    testGlobals.__homeTabSupportGetState.mockResolvedValue(
      capabilityMap({}, false),
    );
    renderHook(() =>
      useHomeWalletTabSupport({
        network: evmNetwork,
        vaultSettings: { NFTEnabled: false },
      }),
    );
    await flushAsyncWork();

    for (
      let attempt = 0;
      attempt < HOME_WALLET_TAB_SUPPORT_MAX_AUTO_RETRIES;
      attempt += 1
    ) {
      await act(async () => {
        jest.advanceTimersByTime(HOME_WALLET_TAB_SUPPORT_RETRY_DELAY_MS);
        await Promise.resolve();
        await Promise.resolve();
      });
    }
    await act(async () => {
      jest.advanceTimersByTime(HOME_WALLET_TAB_SUPPORT_RETRY_DELAY_MS * 2);
      await Promise.resolve();
    });
    expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(
      HOME_WALLET_TAB_SUPPORT_MAX_AUTO_RETRIES + 1,
    );
  });

  it('keeps All Networks complete without waiting for the background map', async () => {
    setStoreOwner('onekeyall--0', true);
    const { result } = renderHook(() =>
      useHomeWalletTabSupport({
        network: allNetworks,
        vaultSettings: { NFTEnabled: false },
      }),
    );
    await waitFor(() => expect(result.current?.resource.kind).toBe('complete'));
    expect(testGlobals.__homeTabSupportGetState).not.toHaveBeenCalled();
  });

  it('cleans up event and focus subscriptions on unmount', async () => {
    const { unmount } = renderHook(() =>
      useHomeWalletTabSupport({
        network: evmNetwork,
        vaultSettings: { NFTEnabled: false },
      }),
    );
    await waitFor(() => {
      expect(testGlobals.__homeTabSupportEventListeners.size).toBe(1);
      expect(testGlobals.__homeTabSupportFocusControl.listenerCount).toBe(1);
    });
    unmount();
    expect(testGlobals.__homeTabSupportEventListeners.size).toBe(0);
    expect(testGlobals.__homeTabSupportFocusControl.listenerCount).toBe(0);
  });
});
