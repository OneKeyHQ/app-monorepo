import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

export const TOKENIZED_STOCK_SOURCE_NAME_PATTERN = /\s*\(Ondo Tokenized\)\s*$/i;

export function buildSwapStockMetadataKey({
  contractAddress,
  networkId,
}: {
  contractAddress?: string;
  networkId?: string;
}) {
  if (!contractAddress || !networkId) {
    return '';
  }
  return `${networkId}:${contractAddress.toLowerCase()}`;
}

export function getSwapStockTokenDisplayName({
  stock,
  tokenName,
}: {
  stock?: Pick<IMarketStockInfo, 'subtitle'>;
  tokenName?: string;
}) {
  const stockSubtitle = stock?.subtitle?.trim();
  if (stockSubtitle) {
    return stockSubtitle;
  }
  return (
    tokenName?.replace(TOKENIZED_STOCK_SOURCE_NAME_PATTERN, '') ?? tokenName
  );
}

export function isSwapStockMetadataPending({
  isSwapStockSelectTarget,
  resolvedStockMetadataTokenKey,
  stockMetadataLoading,
  stockMetadataTokenKey,
}: {
  isSwapStockSelectTarget: boolean;
  resolvedStockMetadataTokenKey?: string;
  stockMetadataLoading?: boolean;
  stockMetadataTokenKey?: string;
}) {
  return Boolean(
    isSwapStockSelectTarget &&
    stockMetadataTokenKey &&
    (stockMetadataLoading ||
      resolvedStockMetadataTokenKey !== stockMetadataTokenKey),
  );
}

export function isSwapNetworkBridgeOnly(
  network?: Pick<ISwapNetwork, 'supportCrossChainSwap' | 'supportSingleSwap'>,
) {
  return Boolean(network?.supportCrossChainSwap && !network.supportSingleSwap);
}

export function isSwapTokenSelectorFromNetworkBridgeOnly({
  fromTokenNetworkId,
  swapNetworksIncludeAllNetwork,
}: {
  fromTokenNetworkId?: string;
  swapNetworksIncludeAllNetwork: ISwapNetwork[];
}) {
  if (!fromTokenNetworkId) {
    return false;
  }

  return isSwapNetworkBridgeOnly(
    swapNetworksIncludeAllNetwork.find(
      (network) => network.networkId === fromTokenNetworkId,
    ),
  );
}

export function buildSwapStockSelectableNetworks({
  isSwapStockSelectTarget,
  rawSwapNetworks,
  stockSelectDefaultNetworkId,
  swapNetworksIncludeAllNetworkBase,
}: {
  isSwapStockSelectTarget: boolean;
  rawSwapNetworks: ISwapNetwork[];
  stockSelectDefaultNetworkId?: string;
  swapNetworksIncludeAllNetworkBase: ISwapNetwork[];
}) {
  if (!isSwapStockSelectTarget || !stockSelectDefaultNetworkId) {
    return swapNetworksIncludeAllNetworkBase;
  }
  if (
    swapNetworksIncludeAllNetworkBase.some(
      (network) => network.networkId === stockSelectDefaultNetworkId,
    )
  ) {
    return swapNetworksIncludeAllNetworkBase;
  }
  const stockNetwork = rawSwapNetworks.find(
    (network) => network.networkId === stockSelectDefaultNetworkId,
  );
  if (!stockNetwork?.supportStock) {
    return swapNetworksIncludeAllNetworkBase;
  }
  const [allNetwork, ...networks] = swapNetworksIncludeAllNetworkBase;
  if (!allNetwork) {
    return [stockNetwork, ...networks];
  }
  return [allNetwork, stockNetwork, ...networks];
}

export function buildSwapTokenSelectorDisableNetworks({
  type,
  swapTypeSwitch,
  fromToken,
  swapNetworksIncludeAllNetwork,
}: {
  type: ESwapDirectionType;
  swapTypeSwitch: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  swapNetworksIncludeAllNetwork: ISwapNetwork[];
}) {
  const networkIds = swapNetworksIncludeAllNetwork.map(
    (network) => network.networkId,
  );

  if (swapTypeSwitch !== ESwapTabSwitchType.SWAP) {
    if (
      (swapTypeSwitch === ESwapTabSwitchType.LIMIT ||
        swapTypeSwitch === ESwapTabSwitchType.STOCK) &&
      type === ESwapDirectionType.TO &&
      fromToken?.networkId
    ) {
      return networkIds.filter(
        (networkId) => networkId !== fromToken.networkId,
      );
    }

    return [];
  }

  if (
    type === ESwapDirectionType.TO &&
    fromToken?.networkId &&
    isSwapTokenSelectorFromNetworkBridgeOnly({
      fromTokenNetworkId: fromToken.networkId,
      swapNetworksIncludeAllNetwork,
    })
  ) {
    return [fromToken.networkId];
  }

  return [];
}
