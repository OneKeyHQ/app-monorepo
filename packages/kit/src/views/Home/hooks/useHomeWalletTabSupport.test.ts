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
  const state = {
    perpDisabled: false,
    perpTabShowWeb: false,
  };
  (globalThis as any).__homeTabSupportPerpConfig = state;
  return {
    usePerpTabConfig: () => state,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCommonConfigPersistAtom: () => [{ perpConfigLoaded: true }],
}));

jest.mock('../model/react/homeStoreHooks', () => ({
  useHomeFactsSnapshot: () => undefined,
}));

jest.mock('../model/react/useHomeNavigationCoordinator', () => ({
  useHomeNavigationCoordinator: () => ({
    navigation: undefined,
    selectTab: () => false,
  }),
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
  return {
    useActiveAccount: () => state,
  };
});

jest.mock('../../../background/instance/backgroundApiProxy', () => {
  const getDeFiEnabledNetworksMapState = jest.fn();
  (globalThis as any).__homeTabSupportGetState = getDeFiEnabledNetworksMapState;
  return {
    __esModule: true,
    default: {
      serviceDeFi: {
        getDeFiEnabledNetworksMapState,
      },
    },
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
  HOME_WALLET_TAB_SUPPORT_CACHE_MAX_SIZE,
  HOME_WALLET_TAB_SUPPORT_INIT,
  buildHomeWalletTabSupport,
  buildHomeWalletTabSupportScopeKey,
  hasDeFiSupportedEnabledNetwork,
  rememberConfirmedHomeWalletTabSupport,
  resolveHomeWalletTabSupport,
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
  __homeTabSupportEventBus: {
    emit: jest.Mock;
    off: jest.Mock;
    on: jest.Mock;
  };
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
};

const testGlobals = globalThis as ITestGlobals;

const allNetworksState = {
  enabledNetworks: {},
  disabledNetworks: {},
};

const makeNetwork = (
  id: string,
  overrides?: { isAllNetworks?: boolean; isTestnet?: boolean },
) => ({
  id,
  isAllNetworks: overrides?.isAllNetworks,
  isTestnet: overrides?.isTestnet ?? false,
});

const evmNetwork = makeNetwork('evm--1');
const btcNetwork = makeNetwork('btc--0');

const makeEnabledNetworksMapState = ({
  enabledNetworksMap,
  isReady = true,
}: {
  enabledNetworksMap: Record<string, boolean>;
  isReady?: boolean;
}): IEnabledNetworksMapState => ({
  enabledNetworksMap,
  isReady,
});

const unknownEnabledNetworksMapState = makeEnabledNetworksMapState({
  enabledNetworksMap: {},
  isReady: false,
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Home wallet tab support', () => {
  it('supports DeFi and Perps on a supported single network', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('evm--1'),
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
  });

  it('hides DeFi and Perps on an unsupported single network', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('btc--0'),
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: false,
      isPerpsSupported: false,
    });
  });

  it('shows All Networks tabs when an enabled network supports DeFi', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('onekeyall--0', { isAllNetworks: true }),
        allNetworks: [makeNetwork('btc--0'), makeNetwork('evm--1')],
        allNetworksState,
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
  });

  it('keeps All Networks tabs while the capability map is incomplete', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('onekeyall--0', { isAllNetworks: true }),
        allNetworks: [makeNetwork('btc--0')],
        allNetworksState,
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
  });

  it('keeps All Networks Perps hidden when Perps is globally disabled', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('onekeyall--0', { isAllNetworks: true }),
        allNetworks: [],
        allNetworksState,
        deFiEnabledNetworksMap: {},
        perpDisabled: true,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: false,
    });
  });

  it('does not count a disabled supported network in All Networks', () => {
    expect(
      hasDeFiSupportedEnabledNetwork({
        allNetworks: [makeNetwork('evm--1')],
        allNetworksState: {
          enabledNetworks: {},
          disabledNetworks: { 'evm--1': true },
        },
        deFiEnabledNetworksMap: { 'evm--1': true },
      }),
    ).toBe(false);
  });

  it('counts supported custom networks only when explicitly enabled', () => {
    const customNetwork = makeNetwork('evm--999999');
    expect(
      hasDeFiSupportedEnabledNetwork({
        allNetworks: [customNetwork],
        allNetworksState,
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

  it('keeps Perps hidden when Perps is globally disabled', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('evm--1'),
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: true,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: false,
    });
  });

  it('keeps support unknown when the background capability state is not ready', () => {
    expect(
      buildHomeWalletTabSupport({
        network: evmNetwork,
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
        isReady: false,
      }),
    ).toEqual(HOME_WALLET_TAB_SUPPORT_INIT);
  });

  it('falls back to init before the first support result is ready', () => {
    expect(
      resolveHomeWalletTabSupport({
        result: undefined,
        scopeKey: 'evm--1:single:perp-enabled:0',
        confirmedByScope: new Map(),
        perpDisabled: false,
      }),
    ).toEqual(HOME_WALLET_TAB_SUPPORT_INIT);
  });

  it('keeps confirmed support while the same scope is refreshing', () => {
    const scopeKey = 'account-1:evm--1:single:perp-enabled';
    expect(
      resolveHomeWalletTabSupport({
        result: {
          scopeKey,
          ...HOME_WALLET_TAB_SUPPORT_INIT,
        },
        scopeKey,
        confirmedByScope: new Map([
          [
            scopeKey,
            {
              scopeKey,
              isReady: true,
              isDeFiSupported: true,
              isPerpsSupported: true,
            },
          ],
        ]),
        perpDisabled: false,
      }),
    ).toEqual({
      scopeKey,
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
  });

  it('uses the current scoped support once the refresh resolves', () => {
    expect(
      resolveHomeWalletTabSupport({
        result: {
          scopeKey: 'btc--0:single:perp-enabled:0',
          isReady: true,
          isDeFiSupported: false,
          isPerpsSupported: false,
        },
        scopeKey: 'btc--0:single:perp-enabled:0',
        confirmedByScope: new Map([
          [
            'evm--1:single:perp-enabled:0',
            {
              scopeKey: 'evm--1:single:perp-enabled:0',
              isReady: true,
              isDeFiSupported: true,
              isPerpsSupported: true,
            },
          ],
        ]),
        perpDisabled: false,
      }),
    ).toEqual({
      scopeKey: 'btc--0:single:perp-enabled:0',
      isReady: true,
      isDeFiSupported: false,
      isPerpsSupported: false,
    });
  });

  it('does not reuse supported EVM tabs for a cold unsupported BTC scope', () => {
    const evmScope = buildHomeWalletTabSupportScopeKey({
      accountScopeId: 'account-1',
      networkId: 'evm--1',
      isAllNetworks: false,
    });
    const btcScope = buildHomeWalletTabSupportScopeKey({
      accountScopeId: 'account-1',
      networkId: 'btc--0',
      isAllNetworks: false,
    });
    const confirmedByScope = new Map([
      [
        evmScope,
        {
          scopeKey: evmScope,
          isReady: true,
          isDeFiSupported: true,
          isPerpsSupported: true,
        },
      ],
    ]);

    expect(
      resolveHomeWalletTabSupport({
        result: undefined,
        scopeKey: btcScope,
        confirmedByScope,
        perpDisabled: false,
      }),
    ).toEqual(HOME_WALLET_TAB_SUPPORT_INIT);
  });

  it('restores only the matching confirmed scope across EVM to BTC to EVM', () => {
    const evmScope = 'account-1:evm';
    const btcScope = 'account-1:btc';
    const confirmedByScope = new Map();
    const evmResult = {
      scopeKey: evmScope,
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    };
    const btcResult = {
      scopeKey: btcScope,
      isReady: true,
      isDeFiSupported: false,
      isPerpsSupported: false,
    };

    rememberConfirmedHomeWalletTabSupport({
      confirmedByScope,
      result: evmResult,
      scopeKey: evmScope,
    });
    expect(
      resolveHomeWalletTabSupport({
        result: undefined,
        scopeKey: btcScope,
        confirmedByScope,
        perpDisabled: false,
      }),
    ).toEqual(HOME_WALLET_TAB_SUPPORT_INIT);

    rememberConfirmedHomeWalletTabSupport({
      confirmedByScope,
      result: btcResult,
      scopeKey: btcScope,
    });
    expect(
      resolveHomeWalletTabSupport({
        result: undefined,
        scopeKey: evmScope,
        confirmedByScope,
        perpDisabled: false,
      }),
    ).toEqual(evmResult);
  });

  it('keeps unknown distinct from a confirmed unsupported result', () => {
    const scopeKey = 'account-1:btc';
    const confirmedByScope = new Map();

    expect(
      resolveHomeWalletTabSupport({
        result: undefined,
        scopeKey,
        confirmedByScope,
        perpDisabled: false,
      }),
    ).toEqual(HOME_WALLET_TAB_SUPPORT_INIT);

    rememberConfirmedHomeWalletTabSupport({
      confirmedByScope,
      result: {
        scopeKey,
        isReady: true,
        isDeFiSupported: false,
        isPerpsSupported: false,
      },
      scopeKey,
    });

    expect(
      resolveHomeWalletTabSupport({
        result: undefined,
        scopeKey,
        confirmedByScope,
        perpDisabled: false,
      }),
    ).toMatchObject({
      isReady: true,
      isDeFiSupported: false,
      isPerpsSupported: false,
    });
  });

  it('does not cache an unready or mismatched result', () => {
    const scopeKey = 'account-1:evm';
    const confirmedByScope = new Map();

    rememberConfirmedHomeWalletTabSupport({
      confirmedByScope,
      result: {
        scopeKey,
        ...HOME_WALLET_TAB_SUPPORT_INIT,
      },
      scopeKey,
    });
    rememberConfirmedHomeWalletTabSupport({
      confirmedByScope,
      result: {
        scopeKey: 'account-2:evm',
        isReady: true,
        isDeFiSupported: true,
        isPerpsSupported: true,
      },
      scopeKey,
    });

    expect(confirmedByScope.size).toBe(0);
  });

  it('evicts the least recently used confirmed scope', () => {
    const confirmedByScope = new Map();
    const remember = (scopeKey: string) =>
      rememberConfirmedHomeWalletTabSupport({
        confirmedByScope,
        result: {
          scopeKey,
          isReady: true,
          isDeFiSupported: true,
          isPerpsSupported: true,
        },
        scopeKey,
      });

    for (
      let index = 0;
      index < HOME_WALLET_TAB_SUPPORT_CACHE_MAX_SIZE;
      index += 1
    ) {
      remember(`scope-${index}`);
    }
    resolveHomeWalletTabSupport({
      result: undefined,
      scopeKey: 'scope-0',
      confirmedByScope,
      perpDisabled: false,
    });
    remember(`scope-${HOME_WALLET_TAB_SUPPORT_CACHE_MAX_SIZE}`);

    expect(confirmedByScope.size).toBe(HOME_WALLET_TAB_SUPPORT_CACHE_MAX_SIZE);
    expect(confirmedByScope.has('scope-0')).toBe(true);
    expect(confirmedByScope.has('scope-1')).toBe(false);
    expect(
      confirmedByScope.has(`scope-${HOME_WALLET_TAB_SUPPORT_CACHE_MAX_SIZE}`),
    ).toBe(true);
  });

  it('ignores a stale response after the current scope changes', () => {
    const evmScope = 'account-1:evm';
    const btcScope = 'account-1:btc';
    const confirmedByScope = new Map([
      [
        btcScope,
        {
          scopeKey: btcScope,
          isReady: true,
          isDeFiSupported: false,
          isPerpsSupported: false,
        },
      ],
    ]);
    const staleEvmResult = {
      scopeKey: evmScope,
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    };

    rememberConfirmedHomeWalletTabSupport({
      confirmedByScope,
      result: staleEvmResult,
      scopeKey: btcScope,
    });

    expect(confirmedByScope.has(evmScope)).toBe(false);
    expect(
      resolveHomeWalletTabSupport({
        result: staleEvmResult,
        scopeKey: btcScope,
        confirmedByScope,
        perpDisabled: false,
      }),
    ).toEqual(confirmedByScope.get(btcScope));
  });

  it('keeps account in the cache identity and applies the Perps switch at read time', () => {
    const base = {
      networkId: 'evm--1',
      isAllNetworks: false,
    };

    const accountOne = buildHomeWalletTabSupportScopeKey({
      ...base,
      accountScopeId: 'account-1',
    });
    const accountTwo = buildHomeWalletTabSupportScopeKey({
      ...base,
      accountScopeId: 'account-2',
    });
    expect(accountOne).not.toBe(accountTwo);

    const confirmedByScope = new Map([
      [
        accountOne,
        {
          scopeKey: accountOne,
          isReady: true,
          isDeFiSupported: true,
          isPerpsSupported: true,
        },
      ],
    ]);
    expect(
      resolveHomeWalletTabSupport({
        result: undefined,
        scopeKey: accountOne,
        confirmedByScope,
        perpDisabled: true,
      }),
    ).toMatchObject({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: false,
    });
  });

  it('falls back from indexed account to account and then wallet identity', () => {
    expect(
      resolveHomeWalletTabSupportAccountScopeId({
        indexedAccountId: 'indexed-1',
        accountId: 'account-1',
        walletId: 'wallet-1',
      }),
    ).toBe('indexed-1');
    expect(
      resolveHomeWalletTabSupportAccountScopeId({
        indexedAccountId: '',
        accountId: 'account-1',
        walletId: 'wallet-1',
      }),
    ).toBe('account-1');
    expect(
      resolveHomeWalletTabSupportAccountScopeId({
        walletId: 'wallet-1',
      }),
    ).toBe('wallet-1');
    expect(resolveHomeWalletTabSupportAccountScopeId({})).toBe('');
  });
});

describe('useHomeWalletTabSupport lifecycle', () => {
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
    testGlobals.__homeTabSupportGetState.mockReset();
    testGlobals.__homeTabSupportGetState.mockResolvedValue(
      makeEnabledNetworksMapState({
        enabledNetworksMap: { 'evm--1': true },
      }),
    );
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('keeps a false-ready background result unknown, then refreshes it on the enabled-networks event', async () => {
    testGlobals.__homeTabSupportGetState
      .mockResolvedValueOnce(unknownEnabledNetworksMapState)
      .mockResolvedValueOnce(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      );

    const { result } = renderHook(() =>
      useHomeWalletTabSupport({ network: evmNetwork }),
    );

    await waitFor(() => {
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(1);
      expect(result.current).toMatchObject(HOME_WALLET_TAB_SUPPORT_INIT);
    });

    act(() => {
      testGlobals.__homeTabSupportEventBus.emit('EnabledNetworksChanged');
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isReady: true,
        isDeFiSupported: true,
        isPerpsSupported: true,
      });
    });
    expect(testGlobals.__homeTabSupportGetState).toHaveBeenLastCalledWith({
      syncIfEmpty: true,
    });
  });

  it('recovers a failed background request after the route regains focus', async () => {
    testGlobals.__homeTabSupportGetState
      .mockRejectedValueOnce(new Error('temporary bg failure'))
      .mockResolvedValueOnce(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      );

    const { result } = renderHook(() =>
      useHomeWalletTabSupport({ network: evmNetwork }),
    );
    await waitFor(() => {
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(1);
      expect(result.current).toMatchObject(HOME_WALLET_TAB_SUPPORT_INIT);
    });

    act(() => testGlobals.__homeTabSupportFocusControl.setFocus(false));
    act(() => testGlobals.__homeTabSupportFocusControl.setFocus(true));

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isReady: true,
        isDeFiSupported: true,
        isPerpsSupported: true,
      });
    });
  });

  it('returns a confirmed unsupported result instead of unknown', async () => {
    testGlobals.__homeTabSupportGetState.mockResolvedValueOnce(
      makeEnabledNetworksMapState({
        enabledNetworksMap: { 'evm--1': true },
      }),
    );

    const { result } = renderHook(() =>
      useHomeWalletTabSupport({ network: btcNetwork }),
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isReady: true,
        isDeFiSupported: false,
        isPerpsSupported: false,
      });
    });
  });

  it('ignores an out-of-order response from the previous network scope', async () => {
    const evmRequest = createDeferred<IEnabledNetworksMapState>();
    const btcRequest = createDeferred<IEnabledNetworksMapState>();
    testGlobals.__homeTabSupportGetState
      .mockImplementationOnce(() => evmRequest.promise)
      .mockImplementationOnce(() => btcRequest.promise);

    const { result, rerender } = renderHook(
      ({ network }) => useHomeWalletTabSupport({ network }),
      { initialProps: { network: evmNetwork } },
    );
    await waitFor(() =>
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(1),
    );

    rerender({ network: btcNetwork });
    expect(result.current).toMatchObject(HOME_WALLET_TAB_SUPPORT_INIT);
    await waitFor(() =>
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      btcRequest.resolve(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      );
      await btcRequest.promise;
    });
    await waitFor(() => {
      expect(result.current).toMatchObject({
        isReady: true,
        isDeFiSupported: false,
        isPerpsSupported: false,
      });
    });

    await act(async () => {
      evmRequest.resolve(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      );
      await evmRequest.promise;
    });
    expect(result.current).toMatchObject({
      isReady: true,
      isDeFiSupported: false,
      isPerpsSupported: false,
    });
  });

  it('restores only the matching confirmed state across EVM to BTC to EVM', async () => {
    const finalEvmRefresh = createDeferred<IEnabledNetworksMapState>();
    testGlobals.__homeTabSupportGetState
      .mockResolvedValueOnce(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      )
      .mockResolvedValueOnce(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      )
      .mockImplementationOnce(() => finalEvmRefresh.promise);

    const { result, rerender } = renderHook(
      ({ network }) => useHomeWalletTabSupport({ network }),
      { initialProps: { network: evmNetwork } },
    );
    await waitFor(() => {
      expect(result.current).toMatchObject({
        isReady: true,
        isDeFiSupported: true,
      });
    });

    rerender({ network: btcNetwork });
    expect(result.current).toMatchObject(HOME_WALLET_TAB_SUPPORT_INIT);
    await waitFor(() => {
      expect(result.current).toMatchObject({
        isReady: true,
        isDeFiSupported: false,
      });
    });

    rerender({ network: evmNetwork });
    expect(result.current).toMatchObject({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
    await waitFor(() =>
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(3),
    );
  });

  it('isolates the confirmed cache while owner identity falls back', async () => {
    const accountRequest = createDeferred<IEnabledNetworksMapState>();
    const walletRequest = createDeferred<IEnabledNetworksMapState>();
    testGlobals.__homeTabSupportGetState
      .mockResolvedValueOnce(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      )
      .mockImplementationOnce(() => accountRequest.promise)
      .mockImplementationOnce(() => walletRequest.promise);

    const { result, rerender } = renderHook(() =>
      useHomeWalletTabSupport({ network: evmNetwork }),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));

    testGlobals.__homeTabSupportActiveAccount.activeAccount.indexedAccount =
      undefined;
    rerender();
    expect(result.current).toMatchObject(HOME_WALLET_TAB_SUPPORT_INIT);
    await waitFor(() =>
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(2),
    );
    await act(async () => {
      accountRequest.resolve(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      );
      await accountRequest.promise;
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    testGlobals.__homeTabSupportActiveAccount.activeAccount.account = undefined;
    rerender();
    expect(result.current).toMatchObject(HOME_WALLET_TAB_SUPPORT_INIT);
    await waitFor(() =>
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(3),
    );
    await act(async () => {
      walletRequest.resolve(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      );
      await walletRequest.promise;
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
  });

  it('applies the Perps kill switch immediately to the confirmed scope', async () => {
    const disabledRefresh = createDeferred<IEnabledNetworksMapState>();
    const enabledRefresh = createDeferred<IEnabledNetworksMapState>();
    testGlobals.__homeTabSupportGetState
      .mockResolvedValueOnce(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      )
      .mockImplementationOnce(() => disabledRefresh.promise)
      .mockImplementationOnce(() => enabledRefresh.promise);

    const { result, rerender } = renderHook(() =>
      useHomeWalletTabSupport({ network: evmNetwork }),
    );
    await waitFor(() => expect(result.current.isPerpsSupported).toBe(true));

    testGlobals.__homeTabSupportPerpConfig.perpDisabled = true;
    rerender();
    expect(result.current).toMatchObject({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: false,
    });

    testGlobals.__homeTabSupportPerpConfig.perpDisabled = false;
    rerender();
    expect(result.current).toMatchObject({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
  });

  it('refreshes the current single-network scope on EnabledNetworksChanged without dropping confirmed data', async () => {
    const refreshRequest = createDeferred<IEnabledNetworksMapState>();
    testGlobals.__homeTabSupportGetState
      .mockResolvedValueOnce(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'evm--1': true },
        }),
      )
      .mockImplementationOnce(() => refreshRequest.promise);

    const { result } = renderHook(() =>
      useHomeWalletTabSupport({ network: evmNetwork }),
    );
    await waitFor(() => expect(result.current.isDeFiSupported).toBe(true));

    act(() => {
      testGlobals.__homeTabSupportEventBus.emit('EnabledNetworksChanged');
    });
    expect(result.current).toMatchObject({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
    await waitFor(() =>
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      refreshRequest.resolve(
        makeEnabledNetworksMapState({
          enabledNetworksMap: { 'btc--0': true },
        }),
      );
      await refreshRequest.promise;
    });
    await waitFor(() => {
      expect(result.current).toMatchObject({
        isReady: true,
        isDeFiSupported: false,
        isPerpsSupported: false,
      });
    });
  });

  it('retries unknown capability state a bounded number of times', async () => {
    jest.useFakeTimers();
    testGlobals.__homeTabSupportGetState.mockResolvedValue(
      unknownEnabledNetworksMapState,
    );

    renderHook(() => useHomeWalletTabSupport({ network: evmNetwork }));
    await flushAsyncWork();
    expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(1);

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
      expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(
        attempt + 2,
      );
    }

    await act(async () => {
      jest.advanceTimersByTime(HOME_WALLET_TAB_SUPPORT_RETRY_DELAY_MS * 2);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(testGlobals.__homeTabSupportGetState).toHaveBeenCalledTimes(
      HOME_WALLET_TAB_SUPPORT_MAX_AUTO_RETRIES + 1,
    );
  });

  it('cleans up event and focus subscriptions on unmount', async () => {
    const pendingRequest = createDeferred<IEnabledNetworksMapState>();
    testGlobals.__homeTabSupportGetState.mockImplementationOnce(
      () => pendingRequest.promise,
    );

    const { unmount } = renderHook(() =>
      useHomeWalletTabSupport({ network: evmNetwork }),
    );
    expect(testGlobals.__homeTabSupportEventListeners.size).toBe(1);
    expect(testGlobals.__homeTabSupportFocusControl.listenerCount).toBe(1);

    unmount();
    expect(testGlobals.__homeTabSupportEventListeners.size).toBe(0);
    expect(testGlobals.__homeTabSupportFocusControl.listenerCount).toBe(0);
    expect(testGlobals.__homeTabSupportEventBus.off).toHaveBeenCalledTimes(1);

    pendingRequest.resolve(unknownEnabledNetworksMapState);
    await pendingRequest.promise;
  });
});
