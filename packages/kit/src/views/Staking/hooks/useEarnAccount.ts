import { useCallback, useSyncExternalStore } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';

type IUseEarnAccountParams = {
  networkId?: string;
  accountId?: string;
  indexedAccountId?: string;
  btcOnlyTaproot?: boolean;
};

const MAX_CACHED_NETWORK_DERIVE_TYPES = 64;
const networkDeriveTypes = new Map<string, IAccountDeriveTypes>();
const inFlightNetworkDeriveTypes = new Map<
  string,
  Promise<IAccountDeriveTypes>
>();
const deriveTypeListeners = new Set<() => void>();
let deriveTypeRevision = 0;
let lastDeriveTypeInvalidationAt = 0;
let hasRegisteredDeriveTypeInvalidation = false;

function registerDeriveTypeInvalidation() {
  if (hasRegisteredDeriveTypeInvalidation) {
    return;
  }
  hasRegisteredDeriveTypeInvalidation = true;
  const invalidate = () => {
    networkDeriveTypes.clear();
    inFlightNetworkDeriveTypes.clear();
    lastDeriveTypeInvalidationAt = Date.now();
    deriveTypeRevision += 1;
    deriveTypeListeners.forEach((listener) => listener());
  };
  appEventBus.on(EAppEventBusNames.WalletClear, invalidate);
  appEventBus.on(EAppEventBusNames.AccountRemove, invalidate);
  appEventBus.on(EAppEventBusNames.AccountUpdate, invalidate);
  appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, invalidate);
  appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, invalidate);
  appEventBus.on(
    EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
    invalidate,
  );
}

function subscribeDeriveTypeRevision(listener: () => void) {
  registerDeriveTypeInvalidation();
  deriveTypeListeners.add(listener);
  return () => deriveTypeListeners.delete(listener);
}

function getDeriveTypeRevision() {
  return deriveTypeRevision;
}

function fetchNetworkDeriveType(scopeKey: string, networkId: string) {
  const existing = inFlightNetworkDeriveTypes.get(scopeKey);
  if (existing) {
    return existing;
  }
  const request =
    backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
      networkId,
    });
  inFlightNetworkDeriveTypes.set(scopeKey, request);
  const clear = () => {
    if (inFlightNetworkDeriveTypes.get(scopeKey) === request) {
      inFlightNetworkDeriveTypes.delete(scopeKey);
    }
  };
  void request.then(clear, clear);
  return request;
}

export function useEarnAccount({
  networkId,
  accountId,
  indexedAccountId,
  btcOnlyTaproot = true,
}: IUseEarnAccountParams) {
  const currentDeriveTypeRevision = useSyncExternalStore(
    subscribeDeriveTypeRevision,
    getDeriveTypeRevision,
    getDeriveTypeRevision,
  );
  const {
    activeAccount: { indexedAccount },
  } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  // For accountId: only use othersWalletAccountId (external/imported wallets).
  // NEVER use account?.id — it's network-specific and will mismatch in cross-network scenarios.
  const resolvedAccountId =
    accountId || selectedAccount.othersWalletAccountId || '';
  // For indexedAccountId: selectedAccount is available immediately from storage sync,
  // bypassing the async activeAccount resolution delay.
  const resolvedIndexedAccountId =
    indexedAccountId || selectedAccount.indexedAccountId || indexedAccount?.id;
  const isIndexedAccountScope = Boolean(
    resolvedIndexedAccountId &&
    (!resolvedAccountId ||
      !accountUtils.isOthersAccount({ accountId: resolvedAccountId })),
  );
  const fixedDeriveType: IAccountDeriveTypes | undefined =
    isIndexedAccountScope &&
    networkId &&
    btcOnlyTaproot &&
    networkUtils.isBTCNetwork(networkId)
      ? 'BIP86'
      : undefined;
  const shouldResolveNetworkDeriveType = Boolean(
    isIndexedAccountScope && networkId && !fixedDeriveType,
  );
  const deriveTypeScopeKey = JSON.stringify([
    networkId,
    resolvedAccountId,
    resolvedIndexedAccountId,
    selectedAccount.othersWalletAccountId,
    selectedAccount.indexedAccountId,
    selectedAccount.deriveType,
  ]);
  const cachedNetworkDeriveType = shouldResolveNetworkDeriveType
    ? networkDeriveTypes.get(deriveTypeScopeKey)
    : undefined;
  const {
    result: networkDeriveTypeResult,
    run: runNetworkDeriveType,
    isLoading: networkDeriveTypeLoading,
  } = usePromiseResult(
    async () => {
      if (!networkId || !shouldResolveNetworkDeriveType) {
        return undefined;
      }
      const requestRevision = currentDeriveTypeRevision;
      const cached = networkDeriveTypes.get(deriveTypeScopeKey);
      if (cached) {
        return {
          scopeKey: deriveTypeScopeKey,
          revision: requestRevision,
          networkId,
          deriveType: cached,
          failed: false,
        };
      }
      registerDeriveTypeInvalidation();
      try {
        const deriveType = await fetchNetworkDeriveType(
          deriveTypeScopeKey,
          networkId,
        );
        if (requestRevision !== getDeriveTypeRevision()) {
          return undefined;
        }
        if (networkDeriveTypes.size >= MAX_CACHED_NETWORK_DERIVE_TYPES) {
          const oldestScopeKey = networkDeriveTypes.keys().next().value;
          if (oldestScopeKey) {
            networkDeriveTypes.delete(oldestScopeKey);
          }
        }
        networkDeriveTypes.set(deriveTypeScopeKey, deriveType);
        return {
          scopeKey: deriveTypeScopeKey,
          revision: requestRevision,
          networkId,
          deriveType,
          failed: false,
        };
      } catch {
        if (requestRevision !== getDeriveTypeRevision()) {
          return undefined;
        }
        return {
          scopeKey: deriveTypeScopeKey,
          revision: requestRevision,
          networkId,
          deriveType: undefined,
          failed: true,
        };
      }
    },
    [
      currentDeriveTypeRevision,
      deriveTypeScopeKey,
      networkId,
      shouldResolveNetworkDeriveType,
    ],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
    },
  );
  const networkDeriveType =
    cachedNetworkDeriveType ||
    (networkDeriveTypeResult?.scopeKey === deriveTypeScopeKey &&
    networkDeriveTypeResult.revision === currentDeriveTypeRevision
      ? networkDeriveTypeResult.deriveType
      : undefined);
  const hasNetworkDeriveTypeError = Boolean(
    shouldResolveNetworkDeriveType &&
    !networkDeriveTypeLoading &&
    networkDeriveTypeResult?.failed &&
    networkDeriveTypeResult.scopeKey === deriveTypeScopeKey &&
    networkDeriveTypeResult.revision === currentDeriveTypeRevision,
  );
  const effectiveDeriveType = isIndexedAccountScope
    ? fixedDeriveType || networkDeriveType
    : undefined;
  const hasResolvedAccountScope = isIndexedAccountScope
    ? Boolean(resolvedIndexedAccountId && effectiveDeriveType)
    : Boolean(resolvedAccountId);
  const swrKey =
    networkId && hasResolvedAccountScope
      ? swrKeys.earnAccount({
          networkId,
          accountId: resolvedAccountId,
          indexedAccountId: resolvedIndexedAccountId,
          deriveType: effectiveDeriveType,
          btcOnlyTaproot,
        })
      : undefined;

  const {
    result: earnAccountResult,
    run: runEarnAccount,
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!networkId || !hasResolvedAccountScope) {
        return undefined;
      }
      const requestRevision = currentDeriveTypeRevision;
      try {
        const earnAccount =
          await backgroundApiProxy.serviceStaking.getEarnAccount({
            accountId: resolvedAccountId,
            networkId,
            indexedAccountId: resolvedIndexedAccountId,
            deriveType: effectiveDeriveType,
            btcOnlyTaproot,
          });
        return {
          networkId,
          scopeKey: swrKey,
          accountRevision: requestRevision,
          resolvedAt: Math.max(Date.now(), lastDeriveTypeInvalidationAt + 1),
          earnAccount,
          failed: false,
        };
      } catch {
        // A failed revalidation must not discard a still-valid account from
        // this exact scope; a cold failure has no such fallback and is terminal.
        const cached = swrKey
          ? swrCacheUtils.getWithTimestamp<{
              networkId: string;
              scopeKey?: string;
              accountRevision?: number;
              earnAccount?: Awaited<
                ReturnType<
                  typeof backgroundApiProxy.serviceStaking.getEarnAccount
                >
              >;
            }>(swrKey)
          : undefined;
        const cachedEarnAccount =
          requestRevision === getDeriveTypeRevision() &&
          cached?.data.networkId === networkId &&
          cached.data.scopeKey === swrKey &&
          cached.data.accountRevision === requestRevision &&
          cached.updatedAt > lastDeriveTypeInvalidationAt
            ? cached.data.earnAccount
            : undefined;
        return {
          networkId,
          scopeKey: swrKey,
          accountRevision: requestRevision,
          resolvedAt: Math.max(Date.now(), lastDeriveTypeInvalidationAt + 1),
          earnAccount: cachedEarnAccount,
          failed: true,
        };
      }
    },
    [
      networkId,
      resolvedAccountId,
      resolvedIndexedAccountId,
      effectiveDeriveType,
      btcOnlyTaproot,
      hasResolvedAccountScope,
      swrKey,
      currentDeriveTypeRevision,
    ],
    {
      watchLoading: true,
      undefinedResultIfReRun: false,
      swrKey,
      swrShouldPersist: (result) =>
        !result?.failed && Boolean(result?.earnAccount),
    },
  );

  const hasCurrentEarnAccountResult = Boolean(
    earnAccountResult &&
    earnAccountResult.networkId === networkId &&
    (!earnAccountResult.scopeKey || earnAccountResult.scopeKey === swrKey) &&
    (lastDeriveTypeInvalidationAt === 0 ||
      (earnAccountResult.accountRevision === currentDeriveTypeRevision &&
        (earnAccountResult.resolvedAt ?? 0) > lastDeriveTypeInvalidationAt)),
  );
  const earnAccount = hasCurrentEarnAccountResult
    ? earnAccountResult?.earnAccount
    : undefined;
  const hasEarnAccountError = Boolean(
    hasResolvedAccountScope &&
    !isLoading &&
    hasCurrentEarnAccountResult &&
    earnAccountResult?.failed &&
    earnAccount === undefined,
  );
  const refreshAccount = useCallback(async () => {
    if (shouldResolveNetworkDeriveType && !networkDeriveType) {
      await runNetworkDeriveType({ alwaysSetState: true });
      return;
    }
    await runEarnAccount({ alwaysSetState: true });
  }, [
    networkDeriveType,
    runEarnAccount,
    runNetworkDeriveType,
    shouldResolveNetworkDeriveType,
  ]);

  return {
    earnAccount,
    isError: hasNetworkDeriveTypeError || hasEarnAccountError,
    isLoading:
      (isLoading && !hasEarnAccountError) ||
      (shouldResolveNetworkDeriveType &&
        !networkDeriveType &&
        !hasNetworkDeriveTypeError) ||
      (hasResolvedAccountScope && !hasCurrentEarnAccountResult),
    refreshAccount,
  };
}
