import { useEffect, useMemo, useRef, useState } from 'react';

import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import {
  HOME_WALLET_TAB_SUPPORT_INIT,
  type IHomeWalletTabSupportConfirmedCache,
  type IHomeWalletTabSupportNetwork,
  type IScopedHomeWalletTabSupportState,
  buildHomeWalletTabSupport,
  buildHomeWalletTabSupportScopeKey,
  rememberConfirmedHomeWalletTabSupport,
  resolveHomeWalletTabSupport,
  resolveHomeWalletTabSupportAccountScopeId,
} from './homeWalletTabSupportUtils';

export const HOME_WALLET_TAB_SUPPORT_RETRY_DELAY_MS = 30_500;
export const HOME_WALLET_TAB_SUPPORT_MAX_AUTO_RETRIES = 2;

export function useHomeWalletTabSupport({
  network,
}: {
  network?: IHomeWalletTabSupportNetwork | null;
}) {
  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();
  const {
    activeAccount: { account, indexedAccount, wallet },
  } = useActiveAccount({ num: 0 });
  const [revalidationNonce, setRevalidationNonce] = useState(0);
  const networkId = network?.id;
  const isAllNetworks = networkUtils.isAllNetwork({ networkId });
  const isTestnet = network?.isTestnet ?? false;
  const currentNetwork = useMemo(
    () =>
      networkId
        ? {
            id: networkId,
            isAllNetworks,
            isTestnet,
          }
        : undefined,
    [isAllNetworks, isTestnet, networkId],
  );

  useEffect(() => {
    const onEnabledNetworksChanged = () => {
      setRevalidationNonce((value) => value + 1);
    };

    appEventBus.on(
      EAppEventBusNames.EnabledNetworksChanged,
      onEnabledNetworksChanged,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.EnabledNetworksChanged,
        onEnabledNetworksChanged,
      );
    };
  }, []);

  const accountScopeId = resolveHomeWalletTabSupportAccountScopeId({
    indexedAccountId: indexedAccount?.id,
    accountId: account?.id,
    walletId: wallet?.id,
  });
  const scopeKey = useMemo(
    () =>
      buildHomeWalletTabSupportScopeKey({
        accountScopeId,
        networkId: networkId ?? '',
        isAllNetworks,
      }),
    [accountScopeId, isAllNetworks, networkId],
  );
  const requestKey = `${scopeKey}:${perpDisabled ? 'perp-disabled' : 'perp-enabled'}:${revalidationNonce}`;
  const hasResolvedScope = Boolean(accountScopeId && currentNetwork);

  const { result } = usePromiseResult<IScopedHomeWalletTabSupportState>(
    async () => {
      // Refresh requests independently without changing the confirmed scope.
      void requestKey;
      if (!currentNetwork || !accountScopeId) {
        return {
          scopeKey,
          ...HOME_WALLET_TAB_SUPPORT_INIT,
        };
      }

      if (isAllNetworks) {
        return {
          scopeKey,
          ...buildHomeWalletTabSupport({
            network: currentNetwork,
            deFiEnabledNetworksMap: {},
            perpDisabled,
          }),
        };
      }

      try {
        const { enabledNetworksMap, isReady } =
          await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMapState({
            syncIfEmpty: true,
          });

        return {
          scopeKey,
          ...buildHomeWalletTabSupport({
            network: currentNetwork,
            deFiEnabledNetworksMap: enabledNetworksMap,
            perpDisabled,
            isReady,
          }),
        };
      } catch {
        return {
          scopeKey,
          ...HOME_WALLET_TAB_SUPPORT_INIT,
        };
      }
    },
    [
      accountScopeId,
      currentNetwork,
      isAllNetworks,
      perpDisabled,
      requestKey,
      scopeKey,
    ],
    {
      initResult: {
        scopeKey,
        ...(isAllNetworks && hasResolvedScope
          ? buildHomeWalletTabSupport({
              network: currentNetwork,
              deFiEnabledNetworksMap: {},
              perpDisabled,
            })
          : HOME_WALLET_TAB_SUPPORT_INIT),
      },
      undefinedResultIfReRun: true,
      revalidateOnFocus: true,
    },
  );

  const confirmedByScopeRef = useRef<IHomeWalletTabSupportConfirmedCache>(
    new Map(),
  );
  useEffect(() => {
    rememberConfirmedHomeWalletTabSupport({
      confirmedByScope: confirmedByScopeRef.current,
      result,
      scopeKey,
    });
  }, [result, scopeKey]);

  const retryStateRef = useRef({ scopeKey: '', attempts: 0 });
  useEffect(() => {
    if (retryStateRef.current.scopeKey !== scopeKey) {
      retryStateRef.current = { scopeKey, attempts: 0 };
    }
    if (
      !hasResolvedScope ||
      isAllNetworks ||
      result?.scopeKey !== scopeKey ||
      result.isReady
    ) {
      if (result?.scopeKey === scopeKey && result.isReady) {
        retryStateRef.current.attempts = 0;
      }
      return;
    }
    if (
      retryStateRef.current.attempts >= HOME_WALLET_TAB_SUPPORT_MAX_AUTO_RETRIES
    ) {
      return;
    }

    const timer = setTimeout(() => {
      if (retryStateRef.current.scopeKey !== scopeKey) {
        return;
      }
      retryStateRef.current.attempts += 1;
      setRevalidationNonce((value) => value + 1);
    }, HOME_WALLET_TAB_SUPPORT_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasResolvedScope, isAllNetworks, result, scopeKey]);

  const tabSupport = resolveHomeWalletTabSupport({
    result,
    scopeKey,
    confirmedByScope: confirmedByScopeRef.current,
    perpDisabled,
  });

  return {
    ...tabSupport,
    perpTabShowWeb,
  };
}
