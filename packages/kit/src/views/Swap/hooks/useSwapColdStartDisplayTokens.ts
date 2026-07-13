import { useRef } from 'react';

import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { parseColdStartSnapshotRaw } from '@onekeyhq/shared/src/utils/coldStartCacheSnapshotUtils';
import {
  getSwapColdStartSelectedTokensFromSnapshot,
  isSwapColdStartAllNetworkContextNetworkId,
} from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapDefaultLimitSelectedTokens,
  buildSwapDefaultSelectedTokensFromHomeAccount,
} from '../utils/swapColdStartTokenCacheUtils';

const COLD_START_SCOPED_KEY_SEPARATOR = '::';
const SWAP_STORE_SCOPE_KEY = 'store:swap';
const ACCOUNT_SELECTOR_HOME_SCOPE_KEY = 'store:accountSelector@home';
const ACCOUNT_SELECTOR_SWAP_SCOPE_KEY = 'store:accountSelector@swap';

type IGlobalColdStartCache = typeof globalThis & {
  __ONEKEY_COLD_START_CACHE_MAP__?: Map<string, unknown>;
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
};

type ISelectedAccountSnapshot = {
  walletId?: string;
  indexedAccountId?: string;
  othersWalletAccountId?: string;
  deriveType?: string;
  networkId?: string;
};

type ISelectedAccountsSnapshot = Record<
  string | number,
  ISelectedAccountSnapshot | undefined
>;

type IDisplayTokens = {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
};

function isSnapshotRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildContextAtomSnapshotKey({
  coldStartScopeKey,
  coldStartCacheKey,
}: {
  coldStartScopeKey: string;
  coldStartCacheKey: string;
}) {
  return `${coldStartScopeKey}${COLD_START_SCOPED_KEY_SEPARATOR}${coldStartCacheKey}`;
}

function getSnapshotValue<T>({
  snapshot,
  coldStartScopeKey,
  coldStartCacheKey,
}: {
  snapshot: Record<string, unknown>;
  coldStartScopeKey: string;
  coldStartCacheKey: string;
}) {
  return snapshot[
    buildContextAtomSnapshotKey({
      coldStartScopeKey,
      coldStartCacheKey,
    })
  ] as T | null | undefined;
}

function getSelectedAccountFromSnapshot({
  snapshot,
  coldStartScopeKey,
}: {
  snapshot: Record<string, unknown>;
  coldStartScopeKey: string;
}) {
  const selectedAccounts = getSnapshotValue<ISelectedAccountsSnapshot>({
    snapshot,
    coldStartScopeKey,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
  });
  return selectedAccounts?.[0] ?? selectedAccounts?.['0'];
}

function buildSelectedAccountKey(selectedAccount?: ISelectedAccountSnapshot) {
  const walletId = selectedAccount?.walletId ?? '';
  const accountId =
    selectedAccount?.indexedAccountId ??
    selectedAccount?.othersWalletAccountId ??
    '';
  const deriveType = selectedAccount?.deriveType ?? '';

  if (!walletId && !accountId) {
    return undefined;
  }

  return [walletId, accountId, deriveType].join('|');
}

function hasSwapSelectedTokenSnapshot(snapshot: Record<string, unknown>) {
  return Object.keys(snapshot).some(
    (key) =>
      key.endsWith(
        `::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom}`,
      ) ||
      key.endsWith(
        `::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom}`,
      ),
  );
}

function hasHomeSelectedAccountSnapshot(snapshot: Record<string, unknown>) {
  return Boolean(
    getSelectedAccountFromSnapshot({
      snapshot,
      coldStartScopeKey: ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
    })?.networkId,
  );
}

function getColdStartSnapshotCandidatesFromGlobal() {
  const globalCache = globalThis as IGlobalColdStartCache;
  const snapshots: Record<string, unknown>[] = [];

  const rawSnapshot = globalCache.__ONEKEY_COLD_START_CACHE_MAP__?.get(
    EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
  );
  if (typeof rawSnapshot === 'string') {
    const snapshot = parseColdStartSnapshotRaw(rawSnapshot);
    if (
      isSnapshotRecord(snapshot) &&
      (hasSwapSelectedTokenSnapshot(snapshot) ||
        hasHomeSelectedAccountSnapshot(snapshot))
    ) {
      snapshots.push(snapshot);
    }
  } else if (
    isSnapshotRecord(rawSnapshot) &&
    (hasSwapSelectedTokenSnapshot(rawSnapshot) ||
      hasHomeSelectedAccountSnapshot(rawSnapshot))
  ) {
    snapshots.push(rawSnapshot);
  }

  if (
    isSnapshotRecord(globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__) &&
    (hasSwapSelectedTokenSnapshot(globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__) ||
      hasHomeSelectedAccountSnapshot(globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__))
  ) {
    snapshots.push(globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__);
  }

  return snapshots;
}

function shouldUseRawSwapSelectedTokens(snapshot: Record<string, unknown>) {
  const homeSelectedAccount = getSelectedAccountFromSnapshot({
    snapshot,
    coldStartScopeKey: ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
  });
  const swapSelectedAccount = getSelectedAccountFromSnapshot({
    snapshot,
    coldStartScopeKey: ACCOUNT_SELECTOR_SWAP_SCOPE_KEY,
  });
  const cachedContext = getSnapshotValue<ISwapSelectedTokensColdStartContext>({
    snapshot,
    coldStartScopeKey: SWAP_STORE_SCOPE_KEY,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
  });
  const homeAccountKey = buildSelectedAccountKey(homeSelectedAccount);
  if (!homeSelectedAccount?.networkId || !homeAccountKey) {
    return false;
  }

  if (
    cachedContext?.accountKey === homeAccountKey &&
    cachedContext.networkId === homeSelectedAccount.networkId
  ) {
    return true;
  }

  const swapAccountKey = buildSelectedAccountKey(swapSelectedAccount);
  const isSameOwnerAllNetworksHome =
    isSwapColdStartAllNetworkContextNetworkId(homeSelectedAccount.networkId) &&
    homeAccountKey === swapAccountKey;
  if (!isSameOwnerAllNetworksHome) {
    return false;
  }

  if (!cachedContext) {
    return true;
  }

  return (
    cachedContext.accountKey === swapAccountKey &&
    cachedContext.networkId === swapSelectedAccount?.networkId
  );
}

function getRawSwapSelectedTokensFromSnapshot(
  snapshot: Record<string, unknown>,
): IDisplayTokens {
  if (!shouldUseRawSwapSelectedTokens(snapshot)) {
    return {};
  }

  return {
    fromToken:
      getSnapshotValue<ISwapToken>({
        snapshot,
        coldStartScopeKey: SWAP_STORE_SCOPE_KEY,
        coldStartCacheKey:
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
      }) ?? undefined,
    toToken:
      getSnapshotValue<ISwapToken>({
        snapshot,
        coldStartScopeKey: SWAP_STORE_SCOPE_KEY,
        coldStartCacheKey:
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
      }) ?? undefined,
  };
}

function getDefaultSwapSelectedTokensFromHomeSnapshot(
  snapshot: Record<string, unknown>,
) {
  const homeSelectedAccount = getSelectedAccountFromSnapshot({
    snapshot,
    coldStartScopeKey: ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
  });
  const defaultTokens = buildSwapDefaultSelectedTokensFromHomeAccount({
    homeSelectedAccount,
  });

  return {
    fromToken: defaultTokens?.fromToken,
    toToken: defaultTokens?.toToken,
  };
}

export function getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
  allNetworksOnly = false,
  swapType,
}: {
  allNetworksOnly?: boolean;
  swapType?: ESwapTabSwitchType;
} = {}) {
  for (const snapshot of getColdStartSnapshotCandidatesFromGlobal()) {
    const homeSelectedAccount = getSelectedAccountFromSnapshot({
      snapshot,
      coldStartScopeKey: ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
    });
    const shouldUseSnapshot =
      !allNetworksOnly ||
      isSwapColdStartAllNetworkContextNetworkId(homeSelectedAccount?.networkId);
    if (shouldUseSnapshot) {
      const defaultTokens = buildSwapDefaultSelectedTokensFromHomeAccount({
        homeSelectedAccount,
        swapType,
      });
      if (defaultTokens?.fromToken?.symbol || defaultTokens?.toToken?.symbol) {
        return defaultTokens;
      }
    }
  }

  return undefined;
}

function hasDisplayToken(tokens: IDisplayTokens) {
  return Boolean(tokens.fromToken?.symbol || tokens.toToken?.symbol);
}

export function getSwapColdStartDisplayTokensFromGlobalSnapshot() {
  const displayTokens: {
    fromToken?: ISwapToken;
    toToken?: ISwapToken;
  } = {};

  for (const snapshot of getColdStartSnapshotCandidatesFromGlobal()) {
    const normalizedTokens =
      getSwapColdStartSelectedTokensFromSnapshot<ISwapToken>(snapshot);
    const rawTokens = getRawSwapSelectedTokensFromSnapshot(snapshot);
    const defaultTokens =
      getDefaultSwapSelectedTokensFromHomeSnapshot(snapshot);
    let candidateTokens: IDisplayTokens = defaultTokens;
    if (hasDisplayToken(normalizedTokens)) {
      candidateTokens = normalizedTokens;
    } else if (hasDisplayToken(rawTokens)) {
      candidateTokens = rawTokens;
    }

    if (!displayTokens.fromToken && candidateTokens.fromToken?.symbol) {
      displayTokens.fromToken = candidateTokens.fromToken;
    }
    if (!displayTokens.toToken && candidateTokens.toToken?.symbol) {
      displayTokens.toToken = candidateTokens.toToken;
    }
    if (displayTokens.fromToken && displayTokens.toToken) {
      break;
    }
  }

  return displayTokens;
}

export function useSwapColdStartDisplayTokens({
  fromToken,
  initialSelectedTokensSynced = false,
  swapType,
  toToken,
}: {
  fromToken?: ISwapToken;
  initialSelectedTokensSynced?: boolean;
  swapType?: ESwapTabSwitchType;
  toToken?: ISwapToken;
}) {
  const hasResolvedFromTokenRef = useRef(Boolean(fromToken?.symbol));
  const hasResolvedToTokenRef = useRef(Boolean(toToken?.symbol));
  const coldStartDisplayTokensRef = useRef<
    | ReturnType<typeof getSwapColdStartDisplayTokensFromGlobalSnapshot>
    | undefined
  >(undefined);

  if (fromToken?.symbol) {
    hasResolvedFromTokenRef.current = true;
  }
  if (toToken?.symbol) {
    hasResolvedToTokenRef.current = true;
  }
  if (initialSelectedTokensSynced) {
    hasResolvedFromTokenRef.current = true;
    hasResolvedToTokenRef.current = true;
  }

  if (
    !coldStartDisplayTokensRef.current ||
    (!fromToken?.symbol &&
      !hasResolvedFromTokenRef.current &&
      !coldStartDisplayTokensRef.current.fromToken) ||
    (!toToken?.symbol &&
      !hasResolvedToTokenRef.current &&
      !coldStartDisplayTokensRef.current.toToken)
  ) {
    coldStartDisplayTokensRef.current =
      getSwapColdStartDisplayTokensFromGlobalSnapshot();
  }
  const coldStartDisplayTokens = coldStartDisplayTokensRef.current;
  const defaultDisplayTokens =
    swapType === ESwapTabSwitchType.LIMIT
      ? buildSwapDefaultLimitSelectedTokens()
      : undefined;

  const displayTokens = {
    displayFromToken:
      (fromToken?.symbol ? fromToken : undefined) ||
      (!fromToken?.symbol ? defaultDisplayTokens?.fromToken : undefined) ||
      (hasResolvedFromTokenRef.current
        ? undefined
        : coldStartDisplayTokens.fromToken),
    displayToToken:
      (toToken?.symbol ? toToken : undefined) ||
      (!toToken?.symbol ? defaultDisplayTokens?.toToken : undefined) ||
      (hasResolvedToTokenRef.current
        ? undefined
        : coldStartDisplayTokens.toToken),
  };
  const isInitialFromTokenSelectionPending =
    !hasResolvedFromTokenRef.current && !displayTokens.displayFromToken?.symbol;
  const isInitialToTokenSelectionPending =
    !hasResolvedToTokenRef.current && !displayTokens.displayToToken?.symbol;

  return {
    ...displayTokens,
    isInitialFromTokenSelectionPending,
    isInitialToTokenSelectionPending,
  };
}
