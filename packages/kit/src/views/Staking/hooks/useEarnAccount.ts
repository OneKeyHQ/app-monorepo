import { useEffect } from 'react';

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
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

type IUseEarnAccountParams = {
  networkId?: string;
  accountId?: string;
  indexedAccountId?: string;
  btcOnlyTaproot?: boolean;
};

export function useEarnAccount({
  networkId,
  accountId,
  indexedAccountId,
  btcOnlyTaproot = true,
}: IUseEarnAccountParams) {
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
  const {
    result: networkDeriveType,
    run: refreshNetworkDeriveType,
    isLoading: isDeriveTypeLoading,
  } = usePromiseResult(
    async () => {
      if (!networkId || !shouldResolveNetworkDeriveType) {
        return undefined;
      }
      return backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId,
      });
    },
    [networkId, shouldResolveNetworkDeriveType],
    {
      watchLoading: shouldResolveNetworkDeriveType,
      undefinedResultIfReRun: true,
    },
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
    run: refreshAccount,
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!networkId || !hasResolvedAccountScope) {
        return undefined;
      }
      return {
        networkId,
        earnAccount: await backgroundApiProxy.serviceStaking.getEarnAccount({
          accountId: resolvedAccountId,
          networkId,
          indexedAccountId: resolvedIndexedAccountId,
          deriveType: effectiveDeriveType,
          btcOnlyTaproot,
        }),
      };
    },
    [
      networkId,
      resolvedAccountId,
      resolvedIndexedAccountId,
      effectiveDeriveType,
      btcOnlyTaproot,
      hasResolvedAccountScope,
    ],
    {
      watchLoading: true,
      undefinedResultIfReRun: false,
      swrKey,
      swrShouldPersist: (result) => Boolean(result?.earnAccount),
    },
  );

  useEffect(() => {
    if (!networkId || !shouldResolveNetworkDeriveType) {
      return undefined;
    }

    const refreshAfterDeriveTypeChanged = () => {
      // Clear the previous derive scope before resolving the new authoritative
      // value so stale account data cannot remain actionable during refresh.
      void refreshNetworkDeriveType({ alwaysSetState: true });
    };

    appEventBus.on(
      EAppEventBusNames.GlobalDeriveTypeUpdate,
      refreshAfterDeriveTypeChanged,
    );
    appEventBus.on(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      refreshAfterDeriveTypeChanged,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.GlobalDeriveTypeUpdate,
        refreshAfterDeriveTypeChanged,
      );
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        refreshAfterDeriveTypeChanged,
      );
    };
  }, [networkId, refreshNetworkDeriveType, shouldResolveNetworkDeriveType]);

  const earnAccount =
    earnAccountResult && earnAccountResult.networkId === networkId
      ? earnAccountResult.earnAccount
      : undefined;

  return {
    earnAccount,
    isLoading:
      isLoading ||
      (shouldResolveNetworkDeriveType && isDeriveTypeLoading !== false),
    refreshAccount,
  };
}
