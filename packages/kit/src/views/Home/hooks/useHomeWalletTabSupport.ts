import { useEffect, useMemo, useRef, useState } from 'react';

import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { adaptCurrentHomeCapabilityFacts } from '../model/capabilities/currentHomeCapabilityFactsAdapter';
import { useHomeFactsShadow } from '../model/react/homeSemanticHooks';
import { useHomeNavigationCoordinator } from '../model/react/useHomeNavigationCoordinator';

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

type IHomeWalletTabSupportResult = IScopedHomeWalletTabSupportState & {
  capabilityError?: boolean;
};

export function useHomeWalletTabSupport({
  enableCapabilityAuthority = false,
  network,
  vaultSettings,
}: {
  enableCapabilityAuthority?: boolean;
  network?: IHomeWalletTabSupportNetwork | null;
  vaultSettings?: { NFTEnabled?: boolean };
}) {
  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();
  const [{ perpConfigLoaded }] = usePerpsCommonConfigPersistAtom();
  const homeFacts = useHomeFactsShadow();
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
  const requestKey = `${scopeKey}:${revalidationNonce}`;
  const hasResolvedScope = Boolean(accountScopeId && currentNetwork);

  const { result } = usePromiseResult<IHomeWalletTabSupportResult>(
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
            perpDisabled: false,
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
            perpDisabled: false,
            isReady,
          }),
        };
      } catch {
        return {
          capabilityError: true,
          scopeKey,
          ...HOME_WALLET_TAB_SUPPORT_INIT,
        };
      }
    },
    [accountScopeId, currentNetwork, isAllNetworks, requestKey, scopeKey],
    {
      initResult: {
        scopeKey,
        ...(isAllNetworks && hasResolvedScope
          ? buildHomeWalletTabSupport({
              network: currentNetwork,
              deFiEnabledNetworksMap: {},
              perpDisabled: false,
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
  const isNFTReady = Boolean(isAllNetworks || vaultSettings !== undefined);
  const isNFTEnabled = Boolean(
    isAllNetworks ||
    (vaultSettings?.NFTEnabled &&
      networkUtils.getEnabledNFTNetworkIds().includes(networkId ?? '')),
  );

  const capabilityFacts = useMemo(() => {
    if (!enableCapabilityAuthority || !homeFacts || !networkId) {
      return undefined;
    }
    const ownerMatchesActiveAccount =
      homeFacts.owner.walletId === wallet?.id &&
      homeFacts.owner.accountId === account?.id &&
      (isAllNetworks
        ? homeFacts.owner.network.kind === 'allNetworks'
        : homeFacts.owner.network.kind === 'singleNetwork' &&
          homeFacts.owner.network.networkId === networkId);
    const networkImpl = networkId
      ? networkUtils.getNetworkImpl({ networkId })
      : undefined;
    let networkFamily:
      | 'allNetworks'
      | 'btc'
      | 'evm'
      | 'sol'
      | 'ton'
      | 'tron'
      | 'unknown' = 'unknown';
    if (network?.isAllNetworks) {
      networkFamily = 'allNetworks';
    } else if (
      networkImpl === 'btc' ||
      networkImpl === 'evm' ||
      networkImpl === 'sol' ||
      networkImpl === 'ton' ||
      networkImpl === 'tron'
    ) {
      networkFamily = networkImpl;
    }
    let perpsDestination: 'inline' | 'web' | 'unavailable' = 'inline';
    if (!perpConfigLoaded || perpDisabled) {
      perpsDestination = 'unavailable';
    } else if (perpTabShowWeb) {
      perpsDestination = 'web';
    }
    const capabilityReady = Boolean(
      result?.scopeKey === scopeKey && result.isReady && isNFTReady,
    );
    return adaptCurrentHomeCapabilityFacts({
      accountType: homeFacts.wallet.accountType,
      allNetworks: isAllNetworks,
      expectedSourceScopeKey: scopeKey,
      errorKind: result?.capabilityError ? 'transport' : undefined,
      isReady: capabilityReady && ownerMatchesActiveAccount,
      networkFamily,
      ownerToken: homeFacts.ownerToken,
      perpsDestination,
      productAvailability: {
        defi: true,
        history: true,
        market: true,
        nft: isNFTEnabled,
        perps: tabSupport.isPerpsSupported,
      },
      serverConfig: {
        defi: tabSupport.isDeFiSupported,
        history: true,
        market: true,
        nft: isNFTEnabled,
        perps: perpConfigLoaded ? !perpDisabled : 'unknown',
      },
      sourceRevision: 'capability-v1',
      sourceScopeKey: capabilityReady ? scopeKey : undefined,
    });
  }, [
    enableCapabilityAuthority,
    homeFacts,
    isAllNetworks,
    isNFTEnabled,
    isNFTReady,
    network?.isAllNetworks,
    networkId,
    perpConfigLoaded,
    perpDisabled,
    perpTabShowWeb,
    result,
    scopeKey,
    tabSupport.isDeFiSupported,
    tabSupport.isPerpsSupported,
    account?.id,
    wallet?.id,
  ]);
  const capabilityCoordinator = useHomeNavigationCoordinator(capabilityFacts);

  return {
    ...tabSupport,
    capabilityNavigation: capabilityCoordinator.navigation,
    selectCapabilityTab: capabilityCoordinator.selectTab,
    perpTabShowWeb,
  };
}
