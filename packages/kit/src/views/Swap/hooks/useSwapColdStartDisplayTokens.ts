import { useRef } from 'react';

import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { parseColdStartSnapshotRaw } from '@onekeyhq/shared/src/utils/coldStartCacheSnapshotUtils';
import {
  getSwapColdStartSelectedTokensFromSnapshot,
  isSwapColdStartAllNetworkContextNetworkId,
  normalizeSwapColdStartCacheSnapshot,
} from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { isSameSwapTokenIdentity } from '@onekeyhq/shared/src/utils/swapTokenIdentity';
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

function hasActiveAccountSnapshot({
  snapshot,
  coldStartScopeKey,
}: {
  snapshot: Record<string, unknown>;
  coldStartScopeKey: string;
}) {
  const activeAccounts = getSnapshotValue<Record<string | number, unknown>>({
    snapshot,
    coldStartScopeKey,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom,
  });
  return Boolean(activeAccounts?.[0] ?? activeAccounts?.['0']);
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
  // The normalized candidate above validates persisted active-account owners.
  // Raw fallback exists only for the earliest pre-read snapshot where active
  // accounts have not been persisted yet. Once either runtime has an active
  // account snapshot, bypassing normalization could revive another owner's
  // token/network metadata during an account-switch persistence race.
  if (
    hasActiveAccountSnapshot({
      snapshot,
      coldStartScopeKey: ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
    }) ||
    hasActiveAccountSnapshot({
      snapshot,
      coldStartScopeKey: ACCOUNT_SELECTOR_SWAP_SCOPE_KEY,
    })
  ) {
    return false;
  }

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

export function getSwapStockColdStartAccountKeyFromGlobalSnapshot() {
  for (const snapshot of getColdStartSnapshotCandidatesFromGlobal()) {
    const normalizedSnapshot = normalizeSwapColdStartCacheSnapshot({
      ...snapshot,
    });
    if (isSnapshotRecord(normalizedSnapshot)) {
      const cachedContext =
        getSnapshotValue<ISwapSelectedTokensColdStartContext>({
          snapshot: normalizedSnapshot,
          coldStartScopeKey: SWAP_STORE_SCOPE_KEY,
          coldStartCacheKey:
            CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
        });
      const visibleSwapType = getSnapshotValue<ESwapTabSwitchType>({
        snapshot: normalizedSnapshot,
        coldStartScopeKey: SWAP_STORE_SCOPE_KEY,
        coldStartCacheKey:
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
      });
      if (
        cachedContext?.accountKey &&
        cachedContext.swapType === ESwapTabSwitchType.STOCK &&
        visibleSwapType === ESwapTabSwitchType.STOCK
      ) {
        return cachedContext.accountKey;
      }
    }
  }

  return undefined;
}

function hasCompleteDisplayTokenPair(
  tokens: IDisplayTokens,
): tokens is Required<IDisplayTokens> {
  return Boolean(tokens.fromToken?.symbol && tokens.toToken?.symbol);
}

function stripColdStartAccountOwnedTokenFields(token: ISwapToken): ISwapToken {
  const {
    accountAddress: _accountAddress,
    balanceParsed: _balanceParsed,
    fiatValue: _fiatValue,
    reservationValue: _reservationValue,
    ...displayToken
  } = token;
  return displayToken;
}

function sanitizeColdStartDisplayTokens(
  tokens: IDisplayTokens,
): IDisplayTokens {
  return {
    fromToken: tokens.fromToken
      ? stripColdStartAccountOwnedTokenFields(tokens.fromToken)
      : undefined,
    toToken: tokens.toToken
      ? stripColdStartAccountOwnedTokenFields(tokens.toToken)
      : undefined,
  };
}

function mergeMatchingColdStartDisplayMetadata({
  coldStartToken,
  liveToken,
}: {
  coldStartToken?: ISwapToken;
  liveToken: ISwapToken;
}) {
  if (
    !coldStartToken ||
    !isSameSwapTokenIdentity({
      token1: coldStartToken,
      token2: liveToken,
    })
  ) {
    return liveToken;
  }

  // These fields are presentation-only and safe to show while the exact live
  // token detail refreshes. Account-owned balance/reservation fields must stay
  // on the live token and remain behind their request-owner guards.
  return {
    ...liveToken,
    logoURI: liveToken.logoURI || coldStartToken.logoURI,
    name: liveToken.name || coldStartToken.name,
    networkLogoURI: liveToken.networkLogoURI || coldStartToken.networkLogoURI,
  };
}

export function getSwapDisplayTokenPair({
  coldStartTokens,
  defaultTokens,
  fromToken,
  initialSelectedTokensSynced,
  toToken,
}: {
  coldStartTokens: IDisplayTokens;
  defaultTokens?: IDisplayTokens;
  fromToken?: ISwapToken;
  initialSelectedTokensSynced: boolean;
  toToken?: ISwapToken;
}): IDisplayTokens {
  const liveTokens = { fromToken, toToken };
  if (hasCompleteDisplayTokenPair(liveTokens)) {
    let displaySeedTokens: Required<IDisplayTokens> | undefined;
    if (hasCompleteDisplayTokenPair(coldStartTokens)) {
      displaySeedTokens = coldStartTokens;
    } else if (defaultTokens && hasCompleteDisplayTokenPair(defaultTokens)) {
      displaySeedTokens = defaultTokens;
    }
    return {
      fromToken: mergeMatchingColdStartDisplayMetadata({
        coldStartToken: displaySeedTokens?.fromToken,
        liveToken: liveTokens.fromToken,
      }),
      toToken: mergeMatchingColdStartDisplayMetadata({
        coldStartToken: displaySeedTokens?.toToken,
        liveToken: liveTokens.toToken,
      }),
    };
  }

  if (!initialSelectedTokensSynced) {
    if (hasCompleteDisplayTokenPair(coldStartTokens)) {
      return coldStartTokens;
    }
    if (defaultTokens && hasCompleteDisplayTokenPair(defaultTokens)) {
      return defaultTokens;
    }
    return {};
  }

  // Live selections are one candidate. Returning them together avoids mixing
  // one hydrated side with the other side of a boot seed during reconciliation.
  if (fromToken || toToken) {
    return liveTokens;
  }
  if (defaultTokens && hasCompleteDisplayTokenPair(defaultTokens)) {
    return defaultTokens;
  }
  return {};
}

export function getSwapColdStartDisplayTokensFromGlobalSnapshot() {
  for (const snapshot of getColdStartSnapshotCandidatesFromGlobal()) {
    const normalizedTokens =
      getSwapColdStartSelectedTokensFromSnapshot<ISwapToken>(snapshot);
    const rawTokens = getRawSwapSelectedTokensFromSnapshot(snapshot);
    const defaultTokens =
      getDefaultSwapSelectedTokensFromHomeSnapshot(snapshot);

    for (const candidateTokens of [
      normalizedTokens,
      rawTokens,
      defaultTokens,
    ]) {
      if (hasCompleteDisplayTokenPair(candidateTokens)) {
        return sanitizeColdStartDisplayTokens(candidateTokens);
      }
    }
  }

  return {};
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
  const coldStartDisplayTokensRef = useRef<
    | ReturnType<typeof getSwapColdStartDisplayTokensFromGlobalSnapshot>
    | undefined
  >(undefined);

  if (!coldStartDisplayTokensRef.current) {
    coldStartDisplayTokensRef.current =
      getSwapColdStartDisplayTokensFromGlobalSnapshot();
  }
  const coldStartDisplayTokens = coldStartDisplayTokensRef.current;
  const defaultDisplayTokens =
    swapType === ESwapTabSwitchType.LIMIT
      ? buildSwapDefaultLimitSelectedTokens()
      : undefined;
  const displayPair = getSwapDisplayTokenPair({
    coldStartTokens: coldStartDisplayTokens,
    defaultTokens: defaultDisplayTokens,
    fromToken,
    initialSelectedTokensSynced,
    toToken,
  });
  const displayTokens = {
    displayFromToken: displayPair.fromToken,
    displayToToken: displayPair.toToken,
  };
  const isInitialFromTokenSelectionPending =
    !initialSelectedTokensSynced && !displayTokens.displayFromToken?.symbol;
  const isInitialToTokenSelectionPending =
    !initialSelectedTokensSynced && !displayTokens.displayToToken?.symbol;

  return {
    ...displayTokens,
    isInitialFromTokenSelectionPending,
    isInitialToTokenSelectionPending,
  };
}
