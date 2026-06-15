import { ESwapTabSwitchType } from '../../types/swap/types';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';

import { getVisibleSwapTabSwitchType } from './swapTypeUtils';

const COLD_START_SCOPED_KEY_SEPARATOR = '::';
const SWAP_STORE_SCOPE_KEY = 'store:swap';
const ACCOUNT_SELECTOR_HOME_SCOPE_KEY = 'store:accountSelector@home';
const ACCOUNT_SELECTOR_SWAP_SCOPE_KEY = 'store:accountSelector@swap';

type IColdStartAccountLike = {
  ready?: boolean;
  wallet?: { id?: string };
  indexedAccount?: { id?: string };
  account?: { id?: string };
  dbAccount?: { id?: string };
  deriveType?: string;
  network?: { id?: string };
};

type IColdStartActiveAccountsValue = Record<
  string | number,
  IColdStartAccountLike | undefined
>;

export type IColdStartSwapTokenLike = {
  networkId?: string;
};

type IColdStartSelectedAccountLike = {
  walletId?: string;
  indexedAccountId?: string;
  othersWalletAccountId?: string;
  deriveType?: string;
  networkId?: string;
};

type IColdStartSelectedAccountsValue = Record<
  string | number,
  IColdStartSelectedAccountLike | undefined
>;

export type ISwapSelectedTokensColdStartContext = {
  accountKey: string;
  networkId: string;
  swapType?: ESwapTabSwitchType;
  updatedAt: number;
};

// All-network selected accounts use the `onekeyall--*` sentinel network id. This
// util runs on the earliest mobile cold-start path (apps/mobile/index.ts), so we
// intentionally avoid importing networkUtils/presetNetworks here and match the
// impl prefix directly to keep the boot import graph minimal.
const SWAP_COLD_START_ALL_NETWORK_ID_PREFIX = 'onekeyall--';

export function isSwapColdStartAllNetworkContextNetworkId(networkId?: string) {
  return Boolean(networkId?.startsWith(SWAP_COLD_START_ALL_NETWORK_ID_PREFIX));
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

export function buildSwapSelectedTokensColdStartAccountKey(
  activeAccount?: IColdStartAccountLike,
) {
  const walletId = activeAccount?.wallet?.id ?? '';
  // Resolve the DB account id (dbAccount.id) before the INetworkAccount id
  // (account.id) so this runtime active-account key matches the persisted
  // selected-account key, which uses othersWalletAccountId (a DB account id) for
  // "others" wallets. See buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount.
  const accountId =
    activeAccount?.indexedAccount?.id ??
    activeAccount?.dbAccount?.id ??
    activeAccount?.account?.id ??
    '';
  const deriveType = activeAccount?.deriveType ?? '';

  if (!walletId && !accountId) {
    return undefined;
  }

  return [walletId, accountId, deriveType].join('|');
}

function buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
  selectedAccount?: IColdStartSelectedAccountLike,
) {
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

export function buildSwapSelectedTokensColdStartContext({
  activeAccount,
  networkId,
  swapType,
  now = Date.now(),
}: {
  activeAccount?: IColdStartAccountLike;
  networkId?: string;
  swapType?: ESwapTabSwitchType;
  now?: number;
}): ISwapSelectedTokensColdStartContext | undefined {
  if (!activeAccount?.ready || !networkId) {
    return undefined;
  }

  const accountKey = buildSwapSelectedTokensColdStartAccountKey(activeAccount);
  if (!accountKey) {
    return undefined;
  }

  return {
    accountKey,
    networkId,
    swapType,
    updatedAt: now,
  };
}

export function isSwapSelectedTokensColdStartContextMatched({
  cachedContext,
  currentContext,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  currentContext?: ISwapSelectedTokensColdStartContext;
}) {
  if (!cachedContext || !currentContext) {
    return false;
  }

  return (
    cachedContext.accountKey === currentContext.accountKey &&
    cachedContext.networkId === currentContext.networkId
  );
}

function isSwapSelectedTokensColdStartContextMatchedWithHomeAndSwapAccounts({
  cachedContext,
  homeActiveAccount,
  swapActiveAccount,
}: {
  cachedContext: ISwapSelectedTokensColdStartContext;
  homeActiveAccount?: IColdStartAccountLike;
  swapActiveAccount?: IColdStartAccountLike;
}) {
  const homeContext = buildSwapSelectedTokensColdStartContext({
    activeAccount: homeActiveAccount,
    networkId: homeActiveAccount?.network?.id,
  });
  if (
    isSwapSelectedTokensColdStartContextMatched({
      cachedContext,
      currentContext: homeContext,
    })
  ) {
    return true;
  }

  const swapContext = buildSwapSelectedTokensColdStartContext({
    activeAccount: swapActiveAccount,
    networkId: swapActiveAccount?.network?.id,
  });
  if (
    !homeContext &&
    isSwapSelectedTokensColdStartContextMatched({
      cachedContext,
      currentContext: swapContext,
    })
  ) {
    return true;
  }

  const isSameOwnerAllNetworksHome =
    isSwapColdStartAllNetworkContextNetworkId(homeContext?.networkId) &&
    homeContext?.accountKey &&
    homeContext.accountKey === swapContext?.accountKey;

  return Boolean(
    isSameOwnerAllNetworksHome &&
    isSwapSelectedTokensColdStartContextMatched({
      cachedContext,
      currentContext: swapContext,
    }),
  );
}

function getActiveAccountFromSnapshot(
  snapshot: Record<string, unknown>,
  scopeKey: string,
) {
  const activeAccountsKey = buildContextAtomSnapshotKey({
    coldStartScopeKey: scopeKey,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom,
  });
  const activeAccounts = snapshot[activeAccountsKey] as
    | IColdStartActiveAccountsValue
    | null
    | undefined;
  return activeAccounts?.[0] ?? activeAccounts?.['0'];
}

function getSelectedAccountFromSnapshot(
  snapshot: Record<string, unknown>,
  scopeKey: string,
) {
  const selectedAccountsKey = buildContextAtomSnapshotKey({
    coldStartScopeKey: scopeKey,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
  });
  const selectedAccounts = snapshot[selectedAccountsKey] as
    | IColdStartSelectedAccountsValue
    | null
    | undefined;
  return selectedAccounts?.[0] ?? selectedAccounts?.['0'];
}

function deleteSwapSelectedTokensColdStartSnapshot(
  snapshot: Record<string, unknown>,
) {
  [
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
  ].forEach((coldStartCacheKey) => {
    delete snapshot[
      buildContextAtomSnapshotKey({
        coldStartScopeKey: SWAP_STORE_SCOPE_KEY,
        coldStartCacheKey,
      })
    ];
  });
}

function getSwapSnapshotValue<T>(
  snapshot: Record<string, unknown>,
  coldStartCacheKey: string,
) {
  return snapshot[
    buildContextAtomSnapshotKey({
      coldStartScopeKey: SWAP_STORE_SCOPE_KEY,
      coldStartCacheKey,
    })
  ] as T | null | undefined;
}

function setSwapSnapshotValue(
  snapshot: Record<string, unknown>,
  coldStartCacheKey: string,
  value: unknown,
) {
  snapshot[
    buildContextAtomSnapshotKey({
      coldStartScopeKey: SWAP_STORE_SCOPE_KEY,
      coldStartCacheKey,
    })
  ] = value;
}

function isSwapSelectedTokenSnapshotMatchedContext({
  snapshot,
  cachedContext,
}: {
  snapshot: Record<string, unknown>;
  cachedContext: ISwapSelectedTokensColdStartContext;
}) {
  const fromToken = getSwapSnapshotValue<IColdStartSwapTokenLike>(
    snapshot,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
  );

  if (!fromToken?.networkId) {
    return false;
  }

  // In all-network mode the cached context network is the `onekeyall--*` sentinel
  // while the cached from-token carries a concrete chain id, so they never match
  // exactly. Accept any concrete from-token network in that mode; otherwise the
  // all-network cold-start cache would always be discarded on the next launch.
  if (isSwapColdStartAllNetworkContextNetworkId(cachedContext.networkId)) {
    return true;
  }

  return fromToken.networkId === cachedContext.networkId;
}

function inferSwapTypeFromSelectedTokenSnapshot({
  cachedContext,
  fromToken,
  toToken,
}: {
  cachedContext: ISwapSelectedTokensColdStartContext;
  fromToken?: IColdStartSwapTokenLike | null;
  toToken?: IColdStartSwapTokenLike | null;
}) {
  if (
    fromToken?.networkId &&
    toToken?.networkId &&
    fromToken.networkId !== toToken.networkId
  ) {
    return ESwapTabSwitchType.BRIDGE;
  }

  return cachedContext.swapType;
}

function normalizeSwapTypeSnapshot({
  snapshot,
  contextKey,
  cachedContext,
}: {
  snapshot: Record<string, unknown>;
  contextKey: string;
  cachedContext: ISwapSelectedTokensColdStartContext;
}) {
  const fromToken = getSwapSnapshotValue<IColdStartSwapTokenLike>(
    snapshot,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
  );
  const toToken = getSwapSnapshotValue<IColdStartSwapTokenLike>(
    snapshot,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
  );
  const inferredSwapType = inferSwapTypeFromSelectedTokenSnapshot({
    cachedContext,
    fromToken,
    toToken,
  });

  if (!inferredSwapType) {
    return;
  }

  setSwapSnapshotValue(
    snapshot,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
    getVisibleSwapTabSwitchType(inferredSwapType) ?? inferredSwapType,
  );
  snapshot[contextKey] = {
    ...cachedContext,
    swapType: inferredSwapType,
  };
}

function backfillAllNetworkSwapSelectedTokensContext({
  contextKey,
  snapshot,
}: {
  contextKey: string;
  snapshot: Record<string, unknown>;
}) {
  const homeSelectedAccount = getSelectedAccountFromSnapshot(
    snapshot,
    ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
  );
  const swapSelectedAccount = getSelectedAccountFromSnapshot(
    snapshot,
    ACCOUNT_SELECTOR_SWAP_SCOPE_KEY,
  );
  const homeNetworkId = homeSelectedAccount?.networkId;
  if (
    !homeNetworkId ||
    !isSwapColdStartAllNetworkContextNetworkId(homeNetworkId)
  ) {
    return undefined;
  }

  const homeAccountKey =
    buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
      homeSelectedAccount,
    );
  const swapAccountKey =
    buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
      swapSelectedAccount,
    );
  if (!homeAccountKey || homeAccountKey !== swapAccountKey) {
    return undefined;
  }

  const fromToken = getSwapSnapshotValue<IColdStartSwapTokenLike>(
    snapshot,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
  );
  if (!fromToken?.networkId) {
    return undefined;
  }

  const snapshotSwapType = getSwapSnapshotValue<ESwapTabSwitchType>(
    snapshot,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
  );
  const cachedContext: ISwapSelectedTokensColdStartContext = {
    accountKey: homeAccountKey,
    networkId: homeNetworkId,
    swapType: snapshotSwapType ?? undefined,
    updatedAt: Date.now(),
  };
  snapshot[contextKey] = cachedContext;
  normalizeSwapTypeSnapshot({
    snapshot,
    contextKey,
    cachedContext,
  });
  return cachedContext;
}

export function normalizeSwapColdStartCacheSnapshot(
  snapshot: Record<string, unknown>,
) {
  // The mobile boot path (apps/mobile/index.ts) passes JSON.parse(rawMmkvValue)
  // straight in, which can yield null/array/string for legacy or corrupted
  // values. Indexing or deleting on a non-object would throw, and the outer
  // try/catch would then drop the ENTIRE cold-start snapshot (every feature),
  // not just swap. Degrade to the input unchanged, matching parseL2CtxSnapshot.
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return snapshot;
  }

  const contextKey = buildContextAtomSnapshotKey({
    coldStartScopeKey: SWAP_STORE_SCOPE_KEY,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
  });
  let cachedContext = snapshot[contextKey] as
    | ISwapSelectedTokensColdStartContext
    | null
    | undefined;

  if (!cachedContext) {
    cachedContext = backfillAllNetworkSwapSelectedTokensContext({
      contextKey,
      snapshot,
    });
    if (!cachedContext) {
      deleteSwapSelectedTokensColdStartSnapshot(snapshot);
      return snapshot;
    }
  }

  if (
    !isSwapSelectedTokensColdStartContextMatchedWithHomeAndSwapAccounts({
      cachedContext,
      homeActiveAccount: getActiveAccountFromSnapshot(
        snapshot,
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
      ),
      swapActiveAccount: getActiveAccountFromSnapshot(
        snapshot,
        ACCOUNT_SELECTOR_SWAP_SCOPE_KEY,
      ),
    }) ||
    !isSwapSelectedTokenSnapshotMatchedContext({ snapshot, cachedContext })
  ) {
    deleteSwapSelectedTokensColdStartSnapshot(snapshot);
    return snapshot;
  }

  normalizeSwapTypeSnapshot({
    snapshot,
    contextKey,
    cachedContext,
  });

  return snapshot;
}

export function getSwapColdStartSelectedTokensFromSnapshot<
  TSwapToken extends IColdStartSwapTokenLike = IColdStartSwapTokenLike,
>(snapshot: Record<string, unknown>) {
  const normalizedSnapshot = normalizeSwapColdStartCacheSnapshot({
    ...snapshot,
  });

  return {
    fromToken:
      getSwapSnapshotValue<TSwapToken>(
        normalizedSnapshot,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
      ) ?? undefined,
    toToken:
      getSwapSnapshotValue<TSwapToken>(
        normalizedSnapshot,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
      ) ?? undefined,
  };
}
