import { useEffect, useMemo, useRef, useState } from 'react';

import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import {
  HOME_WALLET_TAB_SUPPORT_INIT,
  type IHomeWalletTabSupportNetwork,
  type IScopedHomeWalletTabSupportState,
  buildHomeWalletTabSupport,
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

  const scopeKey = useMemo(
    () =>
      [
        networkId ?? '',
        isAllNetworks ? 'all' : 'single',
        perpDisabled ? 'perp-disabled' : 'perp-enabled',
        enabledNetworksChangedNonce,
      ].join(':'),
    [enabledNetworksChangedNonce, isAllNetworks, networkId, perpDisabled],
  );

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

      const deFiEnabledNetworksMap =
        await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();

      return {
        scopeKey,
        ...buildHomeWalletTabSupport({
          network: currentNetwork,
          deFiEnabledNetworksMap,
          perpDisabled,
        }),
      };
    },
    [currentNetwork, isAllNetworks, scopeKey, perpDisabled],
    {
      initResult: {
        scopeKey,
        ...(isAllNetworks
          ? buildHomeWalletTabSupport({
              network: currentNetwork,
              deFiEnabledNetworksMap: {},
              perpDisabled,
            })
          : HOME_WALLET_TAB_SUPPORT_INIT),
      },
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
