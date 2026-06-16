import type {
  ISwapProviderManager,
  ISwapServiceProvider,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

function uniqueNetworks(networks: (ISwapNetwork | undefined)[]) {
  const networkMap = new Map<string, ISwapNetwork>();
  networks.forEach((network) => {
    if (network?.networkId && !networkMap.has(network.networkId)) {
      networkMap.set(network.networkId, network);
    }
  });
  return Array.from(networkMap.values());
}

function hasNetwork(networks: ISwapNetwork[] | undefined, networkId: string) {
  return !!networks?.some((network) => network.networkId === networkId);
}

function filterNetworksBySupport(
  networks: ISwapNetwork[] | undefined,
  supportNetworks: ISwapNetwork[],
) {
  return (networks ?? []).filter((network) =>
    hasNetwork(supportNetworks, network.networkId),
  );
}

function buildProviderMap(providerManagers: ISwapProviderManager[]) {
  const map = new Map<string, ISwapProviderManager>();
  providerManagers.forEach((providerManager) => {
    map.set(providerManager.providerInfo.provider, providerManager);
  });
  return map;
}

function isUnifiedProviderManager(providerManager: ISwapProviderManager) {
  return (
    providerManager.isSupportSingleSwap !== undefined ||
    providerManager.isSupportCrossChain !== undefined ||
    providerManager.supportSingleSwapNetworks !== undefined ||
    providerManager.supportCrossChainNetworks !== undefined
  );
}

export function hasUnifiedSwapProviderManagers(
  providerManagers: ISwapProviderManager[],
) {
  return providerManagers.some(isUnifiedProviderManager);
}

export function hasUnifiedCrossChainSwapProviderManagers(
  providerManagers: ISwapProviderManager[],
) {
  return providerManagers.some(
    (providerManager) =>
      isUnifiedProviderManager(providerManager) &&
      providerManager.isSupportCrossChain !== false &&
      !!providerManager.supportCrossChainNetworks?.length,
  );
}

function hasProviderSupportNetworks(provider: ISwapServiceProvider) {
  if (
    provider.isSupportSingleSwap &&
    !provider.supportSingleSwapNetworks?.length
  ) {
    return false;
  }
  if (
    provider.isSupportCrossChain &&
    !provider.supportCrossChainNetworks?.length
  ) {
    return false;
  }
  return true;
}

function buildServerCrossChainProviderIdSet(
  serverProviders: ISwapServiceProvider[],
) {
  const crossChainProviderIds = new Set<string>();
  for (const provider of serverProviders) {
    const providerId = provider.providerInfo?.provider;
    if (providerId && provider.isSupportCrossChain) {
      crossChainProviderIds.add(providerId);
    }
  }
  return crossChainProviderIds;
}

export function canUseUnifiedSwapProviderManagers({
  serverProviders,
  unifiedProviderManagers,
  bridgeProviderManagers,
}: {
  serverProviders: ISwapServiceProvider[];
  unifiedProviderManagers: ISwapProviderManager[];
  bridgeProviderManagers: ISwapProviderManager[];
}) {
  if (!serverProviders.length || !unifiedProviderManagers.length) {
    return false;
  }

  const serverProviderIds = new Set<string>();
  for (const provider of serverProviders) {
    const providerId = provider.providerInfo?.provider;
    const hasCapability =
      provider.isSupportSingleSwap || provider.isSupportCrossChain;
    if (hasCapability) {
      if (!providerId || !hasProviderSupportNetworks(provider)) {
        return false;
      }
      serverProviderIds.add(providerId);
    }
  }

  if (!serverProviderIds.size) {
    return false;
  }

  const unifiedCrossChainProviderIds = new Set<string>();
  const serverCrossChainProviderIds =
    buildServerCrossChainProviderIdSet(serverProviders);
  for (const providerManager of unifiedProviderManagers) {
    const providerId = providerManager.providerInfo.provider;
    if (!serverProviderIds.has(providerId)) {
      return false;
    }
    if (
      providerManager.isSupportSingleSwap &&
      !providerManager.supportSingleSwapNetworks?.length
    ) {
      return false;
    }
    if (
      providerManager.isSupportCrossChain &&
      !providerManager.supportCrossChainNetworks?.length
    ) {
      return false;
    }
    if (providerManager.isSupportCrossChain) {
      unifiedCrossChainProviderIds.add(providerId);
    }
  }

  return bridgeProviderManagers
    .filter((providerManager) =>
      serverCrossChainProviderIds.has(providerManager.providerInfo.provider),
    )
    .every((providerManager) =>
      unifiedCrossChainProviderIds.has(providerManager.providerInfo.provider),
    );
}

export function buildUnifiedSwapProviderManagers({
  serverProviders,
  swapProviderManagers,
  bridgeProviderManagers,
}: {
  serverProviders: ISwapServiceProvider[];
  swapProviderManagers: ISwapProviderManager[];
  bridgeProviderManagers: ISwapProviderManager[];
}): ISwapProviderManager[] {
  const swapProviderMap = buildProviderMap(swapProviderManagers);
  const bridgeProviderMap = buildProviderMap(bridgeProviderManagers);

  return serverProviders
    .filter(
      (provider) =>
        provider.isSupportSingleSwap || provider.isSupportCrossChain,
    )
    .map((provider) => {
      const providerId = provider.providerInfo.provider;
      const legacySwapProvider = swapProviderMap.get(providerId);
      const legacyBridgeProvider = bridgeProviderMap.get(providerId);
      const supportSingleSwapNetworks =
        provider.supportSingleSwapNetworks ?? [];
      const supportCrossChainNetworks =
        provider.supportCrossChainNetworks ?? [];
      const supportNetworks = uniqueNetworks([
        ...supportSingleSwapNetworks,
        ...supportCrossChainNetworks,
      ]);
      const singleSwapEnable = provider.isSupportSingleSwap
        ? (legacySwapProvider?.singleSwapEnable ??
          legacySwapProvider?.enable ??
          true)
        : true;
      const crossChainEnable = provider.isSupportCrossChain
        ? (legacySwapProvider?.crossChainEnable ??
          legacyBridgeProvider?.enable ??
          true)
        : true;
      const singleSwapDisableNetworks = filterNetworksBySupport(
        legacySwapProvider?.singleSwapDisableNetworks ??
          legacySwapProvider?.disableNetworks,
        supportSingleSwapNetworks,
      );
      const crossChainDisableNetworks = filterNetworksBySupport(
        legacySwapProvider?.crossChainDisableNetworks ??
          legacyBridgeProvider?.disableNetworks,
        supportCrossChainNetworks,
      );
      const disableNetworks = filterNetworksBySupport(
        uniqueNetworks([
          ...singleSwapDisableNetworks,
          ...crossChainDisableNetworks,
        ]),
        supportNetworks,
      );

      return {
        providerInfo: provider.providerInfo,
        enable: singleSwapEnable && crossChainEnable,
        serviceDisable: provider.providerServiceDisable,
        isSupportSingleSwap: !!provider.isSupportSingleSwap,
        isSupportCrossChain: !!provider.isSupportCrossChain,
        singleSwapEnable,
        crossChainEnable,
        supportSingleSwapNetworks,
        supportCrossChainNetworks,
        supportNetworks,
        disableNetworks,
        singleSwapDisableNetworks,
        crossChainDisableNetworks,
        serviceDisableNetworks: filterNetworksBySupport(
          provider.serviceDisableNetworks,
          supportNetworks,
        ),
      };
    });
}

export function normalizeSwapProviderManagersForSave(
  providerManagers: ISwapProviderManager[],
  mode: 'all' | 'singleSwap' | 'crossChain' = 'all',
): ISwapProviderManager[] {
  return providerManagers.map((providerManager) => {
    const supportSingleSwapNetworks =
      providerManager.supportSingleSwapNetworks ??
      providerManager.supportNetworks ??
      [];
    const supportCrossChainNetworks =
      providerManager.supportCrossChainNetworks ??
      providerManager.supportNetworks ??
      [];
    const currentSingleSwapEnable =
      providerManager.singleSwapEnable ?? providerManager.enable ?? true;
    const currentCrossChainEnable =
      providerManager.crossChainEnable ?? providerManager.enable ?? true;
    let singleSwapEnable = currentSingleSwapEnable;
    if (providerManager.isSupportSingleSwap === false) {
      singleSwapEnable = true;
    } else if (mode === 'all' || mode === 'singleSwap') {
      singleSwapEnable = providerManager.enable ?? true;
    }
    let crossChainEnable = currentCrossChainEnable;
    if (providerManager.isSupportCrossChain === false) {
      crossChainEnable = true;
    } else if (mode === 'all' || mode === 'crossChain') {
      crossChainEnable = providerManager.enable ?? true;
    }
    const singleSwapDisableNetworks = filterNetworksBySupport(
      mode === 'all' || mode === 'singleSwap'
        ? providerManager.disableNetworks
        : providerManager.singleSwapDisableNetworks,
      supportSingleSwapNetworks,
    );
    const crossChainDisableNetworks = filterNetworksBySupport(
      mode === 'all' || mode === 'crossChain'
        ? providerManager.disableNetworks
        : providerManager.crossChainDisableNetworks,
      supportCrossChainNetworks,
    );
    const disableNetworks = filterNetworksBySupport(
      uniqueNetworks([
        ...singleSwapDisableNetworks,
        ...crossChainDisableNetworks,
      ]),
      uniqueNetworks([
        ...supportSingleSwapNetworks,
        ...supportCrossChainNetworks,
      ]),
    );

    return {
      ...providerManager,
      enable: singleSwapEnable && crossChainEnable,
      singleSwapEnable,
      crossChainEnable,
      singleSwapDisableNetworks,
      crossChainDisableNetworks,
      disableNetworks,
    };
  });
}

function isProviderSupportQuoteMode({
  providerManager,
  isCrossChain,
}: {
  providerManager: ISwapProviderManager;
  isCrossChain: boolean;
}) {
  if (isCrossChain) {
    if (providerManager.isSupportCrossChain !== undefined) {
      return providerManager.isSupportCrossChain;
    }
    if (providerManager.supportCrossChainNetworks !== undefined) {
      return providerManager.supportCrossChainNetworks.length > 0;
    }
    return false;
  }
  if (providerManager.isSupportSingleSwap !== undefined) {
    return providerManager.isSupportSingleSwap;
  }
  if (providerManager.supportSingleSwapNetworks !== undefined) {
    return providerManager.supportSingleSwapNetworks.length > 0;
  }
  return true;
}

function isProviderEnabledForQuoteMode({
  providerManager,
  isCrossChain,
}: {
  providerManager: ISwapProviderManager;
  isCrossChain: boolean;
}) {
  if (isCrossChain) {
    return providerManager.crossChainEnable ?? providerManager.enable ?? true;
  }
  return providerManager.singleSwapEnable ?? providerManager.enable ?? true;
}

function isProviderDisabledByNetwork({
  providerManager,
  isCrossChain,
  networkIds,
}: {
  providerManager: ISwapProviderManager;
  isCrossChain: boolean;
  networkIds: string[];
}) {
  const disableNetworks = isCrossChain
    ? (providerManager.crossChainDisableNetworks ??
      providerManager.disableNetworks)
    : (providerManager.singleSwapDisableNetworks ??
      providerManager.disableNetworks);
  return networkIds.some((networkId) => hasNetwork(disableNetworks, networkId));
}

export function getDenySwapProviderString({
  providerManagers,
  fromNetworkId,
  toNetworkId,
}: {
  providerManagers: ISwapProviderManager[];
  fromNetworkId: string;
  toNetworkId: string;
}) {
  const isCrossChain = fromNetworkId !== toNetworkId;
  const networkIds = isCrossChain
    ? [fromNetworkId, toNetworkId]
    : [fromNetworkId];
  const denyProviders = providerManagers.filter((providerManager) => {
    if (
      !isProviderSupportQuoteMode({
        providerManager,
        isCrossChain,
      })
    ) {
      return false;
    }
    return (
      !isProviderEnabledForQuoteMode({
        providerManager,
        isCrossChain,
      }) ||
      isProviderDisabledByNetwork({
        providerManager,
        isCrossChain,
        networkIds,
      })
    );
  });

  if (!denyProviders.length) {
    return undefined;
  }

  return denyProviders
    .map((providerManager) => providerManager.providerInfo.provider)
    .join(',');
}

export function getDenyBridgeProviderString({
  providerManagers,
}: {
  providerManagers: ISwapProviderManager[];
}) {
  const denyProviders = providerManagers.filter(
    (providerManager) => !providerManager.enable,
  );

  if (!denyProviders.length) {
    return undefined;
  }

  return denyProviders
    .map((providerManager) => providerManager.providerInfo.provider)
    .join(',');
}

export function mergeDenyProviderStrings(
  ...denyProviderStrings: (string | undefined)[]
) {
  const providerSet = new Set<string>();

  denyProviderStrings.forEach((denyProviderString) => {
    denyProviderString
      ?.split(',')
      .map((provider) => provider.trim())
      .filter(Boolean)
      .forEach((provider) => providerSet.add(provider));
  });

  if (!providerSet.size) {
    return undefined;
  }

  return Array.from(providerSet).join(',');
}
