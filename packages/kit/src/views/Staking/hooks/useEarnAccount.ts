import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

const DERIVE_TYPE_REFRESH_DELAY_MS = 300;

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
  const deriveType = selectedAccount.deriveType;
  const swrKey =
    networkId && (resolvedAccountId || resolvedIndexedAccountId)
      ? swrKeys.earnAccount({
          networkId,
          accountId: resolvedAccountId,
          indexedAccountId: resolvedIndexedAccountId,
          deriveType,
          btcOnlyTaproot,
        })
      : undefined;

  const {
    result: earnAccountResult,
    run: refreshAccount,
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!networkId || (!resolvedAccountId && !resolvedIndexedAccountId)) {
        return undefined;
      }
      return {
        networkId,
        earnAccount: await backgroundApiProxy.serviceStaking.getEarnAccount({
          accountId: resolvedAccountId,
          networkId,
          indexedAccountId: resolvedIndexedAccountId,
          btcOnlyTaproot,
        }),
      };
    },
    // deriveType invalidates a request whose authoritative network-scoped
    // value is resolved inside ServiceStaking rather than this closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      networkId,
      resolvedAccountId,
      resolvedIndexedAccountId,
      deriveType,
      btcOnlyTaproot,
    ],
    {
      watchLoading: true,
      undefinedResultIfReRun: false,
      swrKey,
      swrShouldPersist: (result) => Boolean(result?.earnAccount),
    },
  );

  useEffect(() => {
    if (!networkId) {
      return undefined;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshAfterDeriveTypeChanged = () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        // The service resolves the authoritative derive type for networkId.
        void refreshAccount({ alwaysSetState: true });
      }, DERIVE_TYPE_REFRESH_DELAY_MS);
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
      if (timer) {
        clearTimeout(timer);
      }
      appEventBus.off(
        EAppEventBusNames.GlobalDeriveTypeUpdate,
        refreshAfterDeriveTypeChanged,
      );
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        refreshAfterDeriveTypeChanged,
      );
    };
  }, [networkId, refreshAccount]);

  const earnAccount =
    earnAccountResult && earnAccountResult.networkId === networkId
      ? earnAccountResult.earnAccount
      : undefined;

  return {
    earnAccount,
    isLoading,
    refreshAccount,
  };
}
