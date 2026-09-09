import { useEffect, useMemo, useRef, useState } from 'react';

import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import {
  type IHomeWalletTabSupportNetwork,
  type IScopedHomeWalletTabSupportState,
  buildHomeWalletTabSupport,
  buildHomeWalletTabSupportScopeKey,
  resolveHomeWalletTabSupport,
} from './homeWalletTabSupportUtils';

export function useHomeWalletTabSupport({
  network,
}: {
  network?: IHomeWalletTabSupportNetwork | null;
}) {
  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();
  const [enabledNetworksChangedNonce, setEnabledNetworksChangedNonce] =
    useState(0);
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
    if (!isAllNetworks) {
      return;
    }

    const onEnabledNetworksChanged = () => {
      setEnabledNetworksChangedNonce((value) => value + 1);
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
  }, [isAllNetworks]);

  useEffect(() => {
    const onDeFiEnabledNetworksChanged = () => {
      setEnabledNetworksChangedNonce((value) => value + 1);
    };

    appEventBus.on(
      EAppEventBusNames.DeFiEnabledNetworksChanged,
      onDeFiEnabledNetworksChanged,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.DeFiEnabledNetworksChanged,
        onDeFiEnabledNetworksChanged,
      );
    };
  }, []);

  // The scope key carries no re-fetch nonce: the nonce only drives a re-run
  // (deps below), while the key must stay stable across sessions so the
  // persisted snapshot matches on the next cold start.
  const scopeKey = useMemo(
    () =>
      buildHomeWalletTabSupportScopeKey({
        networkId,
        isAllNetworks,
        perpDisabled,
      }),
    [isAllNetworks, networkId, perpDisabled],
  );

  // Cold start seeds the first frame from the last resolved support for this
  // scope so the Perps / DeFi tabs are already in place before the background
  // gating round-trip returns (OK-61505). The network-less placeholder is
  // never persisted.
  const swrKey = networkId
    ? swrKeys.homeWalletTabSupport({ scopeKey })
    : undefined;

  const { result } = usePromiseResult<IScopedHomeWalletTabSupportState>(
    async () => {
      if (!currentNetwork) {
        return {
          scopeKey,
          ...buildHomeWalletTabSupport({
            network: currentNetwork,
            deFiEnabledNetworksMap: {},
            perpDisabled,
          }),
        };
      }

      const deFiEnabledNetworksMap =
        await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();

      if (isAllNetworks) {
        const [allNetworksState, { networks }] = await Promise.all([
          backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
          backgroundApiProxy.serviceNetwork.getAllNetworks({
            excludeTestNetwork: true,
            excludeAllNetworkItem: true,
          }),
        ]);

        return {
          scopeKey,
          ...buildHomeWalletTabSupport({
            network: currentNetwork,
            allNetworks: networks,
            allNetworksState,
            deFiEnabledNetworksMap,
            perpDisabled,
          }),
        };
      }

      return {
        scopeKey,
        ...buildHomeWalletTabSupport({
          network: currentNetwork,
          deFiEnabledNetworksMap,
          perpDisabled,
        }),
      };
    },
    // The nonce is a pure re-fetch trigger (enabled networks changed); it is
    // intentionally read by no code path so it stays out of the scope key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentNetwork,
      isAllNetworks,
      scopeKey,
      perpDisabled,
      enabledNetworksChangedNonce,
    ],
    {
      swrKey,
      swrShouldPersist: (value) => value.isReady,
      undefinedResultIfReRun: true,
    },
  );

  const lastReadyResultRef = useRef<
    IScopedHomeWalletTabSupportState | undefined
  >(undefined);
  useEffect(() => {
    if (result?.scopeKey === scopeKey && result.isReady) {
      lastReadyResultRef.current = result;
    }
  }, [result, scopeKey]);

  const tabSupport = resolveHomeWalletTabSupport({
    result,
    scopeKey,
    lastReadyResult: lastReadyResultRef.current,
  });

  return {
    ...tabSupport,
    perpTabShowWeb,
  };
}
