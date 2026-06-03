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
      const disableNetworks = filterNetworksBySupport(
        uniqueNetworks([
          ...(legacySwapProvider?.disableNetworks ?? []),
          ...(legacyBridgeProvider?.disableNetworks ?? []),
        ]),
        supportNetworks,
      );

      return {
        providerInfo: provider.providerInfo,
        enable:
          (legacySwapProvider?.enable ?? true) &&
          (legacyBridgeProvider?.enable ?? true),
        serviceDisable: provider.providerServiceDisable,
        isSupportSingleSwap: !!provider.isSupportSingleSwap,
        isSupportCrossChain: !!provider.isSupportCrossChain,
        supportSingleSwapNetworks,
        supportCrossChainNetworks,
        supportNetworks,
        disableNetworks,
        serviceDisableNetworks: filterNetworksBySupport(
          provider.serviceDisableNetworks,
          supportNetworks,
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

function isProviderDisabledByNetwork({
  providerManager,
  networkIds,
}: {
  providerManager: ISwapProviderManager;
  networkIds: string[];
}) {
  return networkIds.some((networkId) =>
    hasNetwork(providerManager.disableNetworks, networkId),
  );
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
      !providerManager.enable ||
      isProviderDisabledByNetwork({
        providerManager,
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
