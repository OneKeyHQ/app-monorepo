import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ENetworkStatus, type IServerNetwork } from '@onekeyhq/shared/types';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';

function getNetworkImplAndChainId(networkId: string) {
  const separatorIndex = networkId.indexOf('--');
  if (separatorIndex < 0) {
    return {
      impl: networkId,
      chainId: '',
    };
  }

  return {
    impl: networkId.slice(0, separatorIndex),
    chainId: networkId.slice(separatorIndex + 2),
  };
}

function buildMarketNetworkFromBasicConfig(
  configNetwork: IMarketBasicConfigNetwork,
): IServerNetwork {
  const { impl, chainId: chainIdFromNetworkId } = getNetworkImplAndChainId(
    configNetwork.networkId,
  );
  const chainId = configNetwork.chainId || chainIdFromNetworkId || '0';
  const displayName = configNetwork.name || configNetwork.networkId;
  const fallbackSymbol = impl.toUpperCase();

  return {
    id: configNetwork.networkId,
    impl,
    chainId,
    name: displayName,
    code: impl,
    shortname: displayName,
    shortcode: impl,
    symbol: fallbackSymbol,
    logoURI: configNetwork.logoUrl || '',
    decimals: 0,
    feeMeta: {
      decimals: 0,
      symbol: fallbackSymbol,
    },
    defaultEnabled: false,
    status: ENetworkStatus.LISTED,
    isTestnet: false,
    explorerURL: configNetwork.explorerUrl || undefined,
  };
}

function resolveMarketNetworkFromConfig({
  configNetwork,
  networkInfo,
}: {
  configNetwork: IMarketBasicConfigNetwork;
  networkInfo?: IServerNetwork;
}): IServerNetwork {
  if (!networkInfo) {
    return buildMarketNetworkFromBasicConfig(configNetwork);
  }

  return {
    ...networkInfo,
    name: configNetwork.name || networkInfo.name,
    logoURI: configNetwork.logoUrl || networkInfo.logoURI,
    explorerURL: configNetwork.explorerUrl || networkInfo.explorerURL,
  };
}

function resolveMarketHomeNetworkSelection({
  selectedNetworkId,
  networkList,
  isConfigLoading,
}: {
  selectedNetworkId: string;
  networkList: IMarketBasicConfigNetwork[];
  isConfigLoading?: boolean;
}) {
  const allNetworkId = getNetworkIdsMap().onekeyall;
  if (
    isConfigLoading === false &&
    networkList.length > 0 &&
    selectedNetworkId !== allNetworkId &&
    !networkList.some((network) => network.networkId === selectedNetworkId)
  ) {
    return allNetworkId;
  }
  return selectedNetworkId;
}

export {
  buildMarketNetworkFromBasicConfig,
  resolveMarketHomeNetworkSelection,
  resolveMarketNetworkFromConfig,
};
