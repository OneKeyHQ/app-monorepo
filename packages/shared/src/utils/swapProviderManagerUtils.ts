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
        ? (legacySwapProvider?.enable ?? true)
        : true;
      const crossChainEnable = provider.isSupportCrossChain
        ? (legacyBridgeProvider?.enable ?? true)
        : true;
      const singleSwapDisableNetworks = filterNetworksBySupport(
        legacySwapProvider?.disableNetworks,
        supportSingleSwapNetworks,
      );
      const crossChainDisableNetworks = filterNetworksBySupport(
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

    return {
      ...providerManager,
      singleSwapEnable:
        providerManager.isSupportSingleSwap === false
          ? true
          : providerManager.enable,
      crossChainEnable:
        providerManager.isSupportCrossChain === false
          ? true
          : providerManager.enable,
      singleSwapDisableNetworks: filterNetworksBySupport(
        providerManager.disableNetworks,
        supportSingleSwapNetworks,
      ),
      crossChainDisableNetworks: filterNetworksBySupport(
        providerManager.disableNetworks,
        supportCrossChainNetworks,
      ),
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
    return providerManager.isSupportCrossChain !== false;
  }
  return providerManager.isSupportSingleSwap !== false;
}

function isProviderEnabledForQuoteMode({
  providerManager,
  isCrossChain,
}: {
  providerManager: ISwapProviderManager;
  isCrossChain: boolean;
}) {
  if (isCrossChain) {
    return providerManager.crossChainEnable ?? providerManager.enable;
  }
  return providerManager.singleSwapEnable ?? providerManager.enable;
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
