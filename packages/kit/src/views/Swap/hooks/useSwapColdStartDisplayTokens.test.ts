/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  getSwapBalanceDisplayEntryFromGlobalSnapshot,
  getSwapColdStartDisplayTokensFromGlobalSnapshot,
  getSwapDefaultSelectedTokensFromGlobalHomeSnapshot,
  getSwapStockColdStartDisplayTokenFromGlobalSnapshot,
  getSwapStockPayTokenDisplayFromGlobalSnapshot,
  resolveSwapDisplayToken,
  useSwapColdStartDisplayTokens,
} from './useSwapColdStartDisplayTokens';

import type { ISwapDefaultConfigStatus } from '../utils/swapColdStartTokenCacheUtils';

let mockStoredSnapshotRaw: string | undefined;
let mockDefaultConfigStatus: ISwapDefaultConfigStatus = 'pending';

jest.mock('../../../states/jotai/contexts/swap/atoms', () => ({
  useSwapDefaultConfigStatusAtom: () => [mockDefaultConfigStatus],
}));

jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => ({
  readContextAtomSnapshotRaw: () => mockStoredSnapshotRaw,
  writeContextAtomSnapshotRaw: () => undefined,
}));

const SWAP_STORE_SCOPE_KEY = 'store:swap';
const ACCOUNT_SELECTOR_HOME_SCOPE_KEY = 'store:accountSelector@home';

function scopedKey(scopeKey: string, cacheKey: string) {
  return `${scopeKey}::${cacheKey}`;
}

function setGlobalSnapshot(snapshot: Record<string, unknown>) {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };

  mockStoredSnapshotRaw = JSON.stringify(snapshot);
  globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = undefined;
}

function setGlobalContextSnapshot(snapshot: Record<string, unknown>) {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };

  mockStoredSnapshotRaw = undefined;
  globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = snapshot;
}

function clearGlobalSnapshot() {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };

  mockStoredSnapshotRaw = undefined;
  delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
}

function buildHomeSelectedAccount(networkId: string) {
  return {
    walletId: 'wallet-1',
    indexedAccountId: 'indexed-account-1',
    networkId,
    deriveType: 'default',
  };
}

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
};
const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xdai',
  symbol: 'DAI',
  decimals: 18,
};

function setCachedSwapPairSnapshot({
  automatic = false,
  networkId = 'evm--1',
  swapType = ESwapTabSwitchType.SWAP,
}: {
  automatic?: boolean;
  networkId?: string;
  swapType?: ESwapTabSwitchType;
} = {}) {
  const context: ISwapSelectedTokensColdStartContext = {
    accountKey: 'wallet-1|indexed-account-1|default',
    networkId,
    swapType,
    updatedAt: 1,
    ...(automatic
      ? {
          defaultTokenSeed: {
            fromToken: {
              networkId: fromToken.networkId,
              contractAddress: fromToken.contractAddress,
            },
            toToken: {
              networkId: toToken.networkId,
              contractAddress: toToken.contractAddress,
            },
          },
        }
      : {}),
  };
  setGlobalSnapshot({
    [scopedKey(
      ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
    )]: { 0: buildHomeSelectedAccount(networkId) },
    [scopedKey(
      SWAP_STORE_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
    )]: context,
    [scopedKey(
      SWAP_STORE_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
    )]: fromToken,
    [scopedKey(
      SWAP_STORE_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
    )]: toToken,
  });
  return context;
}

describe('getSwapColdStartDisplayTokensFromGlobalSnapshot', () => {
  afterEach(() => {
    clearGlobalSnapshot();
  });

  it('leaves display-only defaults deferred while execution can seed known Home defaults', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: { 0: buildHomeSelectedAccount('evm--1') },
    });

    expect(
      getSwapColdStartDisplayTokensFromGlobalSnapshot({
        defaultConfigStatus: 'pending',
      }),
    ).toEqual({});
    expect(
      getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
        defaultConfigStatus: 'pending',
      }),
    ).toBeDefined();
    expect(
      getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
        defaultConfigStatus: 'failed',
      })?.fromToken?.symbol,
    ).toBe('ETH');
  });

  it('hides an automatic cached pair during the configuration request', () => {
    setCachedSwapPairSnapshot({ automatic: true });

    expect(
      getSwapColdStartDisplayTokensFromGlobalSnapshot({
        defaultConfigStatus: 'pending',
      }),
    ).toEqual({});
  });

  it.each(['success', 'failed'] as const)(
    'keeps automatic display defaults deferred during %s until execution state resolves',
    (defaultConfigStatus) => {
      setCachedSwapPairSnapshot({ automatic: true });

      expect(
        getSwapColdStartDisplayTokensFromGlobalSnapshot({
          defaultConfigStatus,
          deferAutomaticDefaults: true,
        }),
      ).toEqual({});
    },
  );

  it('restores a user-selected cached pair while configuration is pending', () => {
    setCachedSwapPairSnapshot();

    expect(
      getSwapColdStartDisplayTokensFromGlobalSnapshot({
        defaultConfigStatus: 'pending',
        deferAutomaticDefaults: true,
      }),
    ).toEqual({ fromToken, toToken });
  });

  it.each([
    { networkId: 'onekeyall--0', swapType: ESwapTabSwitchType.SWAP },
    { networkId: 'evm--1', swapType: ESwapTabSwitchType.BRIDGE },
    { networkId: 'evm--1', swapType: ESwapTabSwitchType.LIMIT },
  ])(
    'keeps automatic display cache for $networkId / $swapType',
    ({ networkId, swapType }) => {
      setCachedSwapPairSnapshot({ automatic: true, networkId, swapType });

      expect(
        getSwapColdStartDisplayTokensFromGlobalSnapshot({
          defaultConfigStatus: 'pending',
          deferAutomaticDefaults: true,
          swapType,
        }),
      ).toEqual({ fromToken, toToken });
    },
  );

  it('uses home-network defaults when no selected token snapshot exists yet', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('sol--101'),
      },
    });

    expect(getSwapColdStartDisplayTokensFromGlobalSnapshot()).toEqual({
      fromToken: expect.objectContaining({
        networkId: 'sol--101',
        symbol: 'SOL',
      }),
      toToken: expect.objectContaining({
        networkId: 'sol--101',
        symbol: 'USDC',
      }),
    });
  });

  it('restores an owner-scoped balance directly from the boot snapshot', () => {
    const accountKey = 'wallet-1|indexed-account-1|default';
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('evm--1'),
      },
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )]: {
        accountKey,
        networkId: 'evm--1',
        swapType: ESwapTabSwitchType.SWAP,
        updatedAt: 1,
      } satisfies ISwapSelectedTokensColdStartContext,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
      )]: {
        networkId: 'evm--1',
        contractAddress: '',
        isNative: true,
        symbol: 'ETH',
      } satisfies Partial<ISwapToken>,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapBalanceDisplayCacheAtom,
      )]: {
        version: 1,
        entries: [
          {
            accountAddress: '0xAccount',
            accountKey,
            balance: '0.24',
            contractAddress: '',
            isNative: true,
            networkId: 'evm--1',
            updatedAt: 1,
          },
        ],
      },
    });

    const token = {
      networkId: 'evm--1',
      contractAddress: '',
      isNative: true,
      symbol: 'ETH',
    } as ISwapToken;
    expect(
      getSwapBalanceDisplayEntryFromGlobalSnapshot({ token })?.balance,
    ).toBe('0.24');
    expect(
      getSwapBalanceDisplayEntryFromGlobalSnapshot({
        currentAccountKey: 'wallet-1|indexed-account-1|',
        token,
      })?.balance,
    ).toBe('0.24');
    expect(
      getSwapBalanceDisplayEntryFromGlobalSnapshot({
        currentAccountKey: 'wallet-2|indexed-account-2|default',
        token,
      }),
    ).toBeUndefined();
  });

  it('exposes all-networks home defaults for provider cold-start bootstrap', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('onekeyall--0'),
      },
    });

    expect(
      getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
        allNetworksOnly: true,
      }),
    ).toEqual({
      fromToken: expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'ETH',
      }),
      toToken: expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'USDC',
      }),
      context: expect.objectContaining({
        accountKey: 'wallet-1|indexed-account-1|default',
        networkId: 'onekeyall--0',
        swapType: ESwapTabSwitchType.SWAP,
      }),
      swapType: ESwapTabSwitchType.SWAP,
    });
  });

  it('reads all-networks home defaults from the pre-read context snapshot', () => {
    setGlobalContextSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('onekeyall--0'),
      },
    });

    expect(
      getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
        allNetworksOnly: true,
      }),
    ).toEqual({
      fromToken: expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'ETH',
      }),
      toToken: expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'USDC',
      }),
      context: expect.objectContaining({
        accountKey: 'wallet-1|indexed-account-1|default',
        networkId: 'onekeyall--0',
        swapType: ESwapTabSwitchType.SWAP,
      }),
      swapType: ESwapTabSwitchType.SWAP,
    });
  });

  it('does not expose single-network defaults when the bootstrap is all-networks only', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('sol--101'),
      },
    });

    expect(
      getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
        allNetworksOnly: true,
      }),
    ).toBeUndefined();
  });

  it('falls back to home-network defaults when stale selected tokens are invalidated', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('sol--101'),
      },
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )]: {
        accountKey: 'wallet-1|indexed-account-1|default',
        networkId: 'evm--1',
        swapType: ESwapTabSwitchType.SWAP,
        updatedAt: 1,
      } satisfies ISwapSelectedTokensColdStartContext,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
      )]: {
        networkId: 'evm--1',
        symbol: 'ETH',
      } satisfies Partial<ISwapToken>,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
      )]: {
        networkId: 'evm--1',
        symbol: 'USDC',
      } satisfies Partial<ISwapToken>,
    });

    expect(getSwapColdStartDisplayTokensFromGlobalSnapshot()).toEqual({
      fromToken: expect.objectContaining({
        networkId: 'sol--101',
        symbol: 'SOL',
      }),
      toToken: expect.objectContaining({
        networkId: 'sol--101',
        symbol: 'USDC',
      }),
    });
  });
});

describe('getSwapStockColdStartDisplayTokenFromGlobalSnapshot', () => {
  const stockToken = {
    networkId: 'evm--56',
    contractAddress: '0xstock',
    decimals: 18,
    isNative: false,
    isStock: true,
    symbol: 'AAPLon',
  } satisfies Partial<ISwapToken>;

  afterEach(() => {
    clearGlobalSnapshot();
  });

  it('reads a persisted display seed after the boot snapshot was cleaned up', () => {
    setGlobalSnapshot({
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
      )]: stockToken,
    });

    expect(getSwapStockColdStartDisplayTokenFromGlobalSnapshot()).toEqual(
      stockToken,
    );
  });

  it('keeps the display-only stock seed when execution context is stale', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('sol--101'),
      },
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )]: {
        accountKey: 'wallet-1|indexed-account-1|default',
        networkId: 'evm--1',
        swapType: ESwapTabSwitchType.SWAP,
        updatedAt: 1,
      } satisfies ISwapSelectedTokensColdStartContext,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
      )]: stockToken,
    });

    expect(getSwapStockColdStartDisplayTokenFromGlobalSnapshot()).toEqual(
      stockToken,
    );
  });

  it('rejects an invalid stock display seed', () => {
    setGlobalSnapshot({
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
      )]: {
        ...stockToken,
        isStock: false,
      },
    });

    expect(
      getSwapStockColdStartDisplayTokenFromGlobalSnapshot(),
    ).toBeUndefined();
  });
});

describe('getSwapStockPayTokenDisplayFromGlobalSnapshot', () => {
  afterEach(() => {
    clearGlobalSnapshot();
  });

  it('reads an account-scoped Stock pay-token display seed', () => {
    const scope = 'evm--56:indexed-account-1';
    const payToken = {
      networkId: 'evm--56',
      contractAddress: '0xusdt',
      decimals: 18,
      isNative: false,
      symbol: 'USDT',
      logoURI: 'https://example.com/usdt.png',
    } satisfies ISwapToken;
    setGlobalSnapshot({
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockPayTokenDisplayAtom,
      )]: {
        [scope]: payToken,
      },
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
      )]: {
        networkId: 'evm--56',
        contractAddress: '0xstock',
        decimals: 18,
        isNative: false,
        isStock: true,
        symbol: 'AAPLon',
      },
    });

    expect(getSwapStockPayTokenDisplayFromGlobalSnapshot({ scope })).toEqual(
      payToken,
    );
  });

  it('rejects another scope and unsupported display tokens', () => {
    const scope = 'evm--56:indexed-account-1';
    setGlobalSnapshot({
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockPayTokenDisplayAtom,
      )]: {
        [scope]: {
          networkId: 'evm--1',
          contractAddress: '',
          decimals: 18,
          isNative: true,
          symbol: 'ETH',
        },
      },
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
      )]: {
        networkId: 'evm--56',
        contractAddress: '0xstock',
        decimals: 18,
        isNative: false,
        isStock: true,
        symbol: 'AAPLon',
      },
    });

    expect(
      getSwapStockPayTokenDisplayFromGlobalSnapshot({ scope }),
    ).toBeUndefined();
    expect(
      getSwapStockPayTokenDisplayFromGlobalSnapshot({
        scope: 'evm--56:indexed-account-2',
      }),
    ).toBeUndefined();
  });
});

describe('resolveSwapDisplayToken', () => {
  const cachedEthToken = {
    networkId: 'evm--1',
    contractAddress: '',
    decimals: 18,
    isNative: true,
    symbol: 'ETH',
    logoURI: 'https://example.com/eth.png',
  } satisfies ISwapToken;

  it('keeps presentation fields while the same token is rehydrated', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        currentToken: {
          networkId: 'evm--1',
          contractAddress: '',
          decimals: 18,
          isNative: true,
          symbol: 'ETH',
        },
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('fills missing presentation fields from the matching cold-start token', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        currentToken: {
          networkId: 'evm--1',
          contractAddress: '',
          decimals: 18,
          isNative: true,
          symbol: 'ETH',
          logoURI: '',
        },
        fallbackToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('replaces a network logo used as the SOL token logo', () => {
    const solNetworkLogoURI = 'https://example.com/solana-network.png';
    const cachedSolToken = {
      networkId: 'sol--101',
      contractAddress: '',
      decimals: 9,
      isNative: true,
      symbol: 'SOL',
      logoURI: 'https://example.com/sol-token.png',
      networkLogoURI: solNetworkLogoURI,
    } satisfies ISwapToken;

    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        currentToken: {
          ...cachedSolToken,
          logoURI: solNetworkLogoURI,
        },
        fallbackToken: cachedSolToken,
      }),
    ).toEqual(cachedSolToken);
  });

  it('recognizes a network logo from the matching fallback token', () => {
    const solNetworkLogoURI = 'https://example.com/solana-network.png';
    const cachedSolToken = {
      networkId: 'sol--101',
      contractAddress: '',
      decimals: 9,
      isNative: true,
      symbol: 'SOL',
      logoURI: 'https://example.com/sol-token.png',
      networkLogoURI: solNetworkLogoURI,
    } satisfies ISwapToken;

    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        currentToken: {
          networkId: 'sol--101',
          contractAddress: '',
          decimals: 9,
          isNative: true,
          symbol: 'SOL',
          logoURI: solNetworkLogoURI,
        },
        fallbackToken: cachedSolToken,
      }),
    ).toEqual(cachedSolToken);
  });

  it('keeps the cached token visible across the initial selection gap', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: true,
        fallbackToken: cachedEthToken,
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('keeps the previous display token when no global fallback is available', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: true,
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('drops the cached token after initial selection has settled', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        fallbackToken: cachedEthToken,
        previousDisplayToken: cachedEthToken,
      }),
    ).toBeUndefined();
  });

  it('does not leak presentation fields into a different token', () => {
    const solToken = {
      networkId: 'sol--101',
      contractAddress: '',
      decimals: 9,
      isNative: true,
      symbol: 'SOL',
    } satisfies ISwapToken;

    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        currentToken: solToken,
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(solToken);
  });

  it('keeps the modal display token when the global fallback belongs to another store', () => {
    const btcToken = {
      networkId: 'btc--0',
      contractAddress: '',
      decimals: 8,
      isNative: true,
      symbol: 'BTC',
    } satisfies ISwapToken;

    expect(
      resolveSwapDisplayToken({
        allowFallback: true,
        fallbackToken: btcToken,
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('uses the global fallback before the current surface has rendered a token', () => {
    const btcToken = {
      networkId: 'btc--0',
      contractAddress: '',
      decimals: 8,
      isNative: true,
      symbol: 'BTC',
    } satisfies ISwapToken;

    expect(
      resolveSwapDisplayToken({
        allowFallback: true,
        fallbackToken: btcToken,
      }),
    ).toEqual(btcToken);
  });
});

describe('useSwapColdStartDisplayTokens configuration readiness', () => {
  beforeEach(() => {
    mockDefaultConfigStatus = 'pending';
  });

  afterEach(clearGlobalSnapshot);

  it.each(['success', 'failed'] as const)(
    'shows loading for a missing token until configuration settles as %s',
    (settledStatus) => {
      const { result, rerender } = renderHook(() =>
        useSwapColdStartDisplayTokens({
          fromToken,
          initialSelectedTokensSynced: true,
          swapType: ESwapTabSwitchType.SWAP,
        }),
      );
      expect(result.current.displayFromToken).toBe(fromToken);
      expect(result.current.isInitialFromTokenSelectionPending).toBe(false);
      expect(result.current.displayToToken).toBeUndefined();
      expect(result.current.isInitialToTokenSelectionPending).toBe(true);

      mockDefaultConfigStatus = settledStatus;
      rerender();
      expect(result.current.displayToToken).toBeUndefined();
      expect(result.current.isInitialToTokenSelectionPending).toBe(false);
    },
  );

  it('shows an existing default during refresh without a loading skeleton', () => {
    const { result } = renderHook(() =>
      useSwapColdStartDisplayTokens({
        fromToken,
        toToken,
        initialSelectedTokensSynced: true,
        swapType: ESwapTabSwitchType.SWAP,
      }),
    );
    expect(result.current.displayToToken).toBe(toToken);
    expect(result.current.isInitialToTokenSelectionPending).toBe(false);
  });

  it('keeps an existing automatic pair during refresh and waits after owner invalidation', () => {
    setCachedSwapPairSnapshot({ automatic: true });
    const { result, rerender } = renderHook(useSwapColdStartDisplayTokens, {
      initialProps: {
        fromToken: fromToken as ISwapToken | undefined,
        toToken: toToken as ISwapToken | undefined,
        initialSelectedTokensSynced: true,
        swapType: ESwapTabSwitchType.SWAP,
      },
    });

    expect(result.current.displayFromToken).toBe(fromToken);
    expect(result.current.displayToToken).toBe(toToken);
    expect(result.current.isInitialFromTokenSelectionPending).toBe(false);

    mockDefaultConfigStatus = 'success';
    rerender({
      fromToken: undefined,
      toToken: undefined,
      initialSelectedTokensSynced: false,
      swapType: ESwapTabSwitchType.SWAP,
    });
    expect(result.current.displayFromToken).toBeUndefined();
    expect(result.current.displayToToken).toBeUndefined();
    expect(result.current.isInitialFromTokenSelectionPending).toBe(true);

    const configuredFromToken: ISwapToken = {
      ...toToken,
      contractAddress: '0xusdc',
      symbol: 'USDC',
      decimals: 6,
    };
    rerender({
      fromToken: configuredFromToken,
      toToken,
      initialSelectedTokensSynced: true,
      swapType: ESwapTabSwitchType.SWAP,
    });
    expect(result.current.displayFromToken?.symbol).toBe('USDC');
    expect(result.current.displayToToken?.symbol).toBe('DAI');
    expect(result.current.isInitialFromTokenSelectionPending).toBe(false);
  });

  it('drops a previous automatic presentation when its configuration becomes pending', () => {
    setCachedSwapPairSnapshot({ automatic: true });
    mockDefaultConfigStatus = 'failed';
    const { result, rerender } = renderHook(useSwapColdStartDisplayTokens, {
      initialProps: {
        fromToken: fromToken as ISwapToken | undefined,
        toToken: toToken as ISwapToken | undefined,
        swapType: ESwapTabSwitchType.SWAP,
      },
    });
    expect(result.current.displayFromToken?.symbol).toBe('ETH');

    mockDefaultConfigStatus = 'pending';
    rerender({
      fromToken: undefined,
      toToken: undefined,
      swapType: ESwapTabSwitchType.SWAP,
    });
    expect(result.current.displayFromToken).toBeUndefined();
    expect(result.current.displayToToken).toBeUndefined();
    expect(result.current.isInitialFromTokenSelectionPending).toBe(true);
  });
});
