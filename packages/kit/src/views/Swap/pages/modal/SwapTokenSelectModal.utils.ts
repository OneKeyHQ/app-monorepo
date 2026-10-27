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

export function normalizeSwapStockSelectableToken({
  stock,
  token,
}: {
  stock?: IMarketStockInfo;
  token: ISwapToken;
}): ISwapToken & { stock?: IMarketStockInfo } {
  if (!stock) {
    return token;
  }

  return {
    ...token,
    stock,
    isStock: true,
  };
}

export function isSwapStockTokenSearchMatch({
  keyword,
  stock,
  token,
}: {
  keyword?: string;
  stock?: Pick<
    IMarketStockInfo,
    'subtitle' | 'title' | 'underlyingAssetName' | 'underlyingAssetTicker'
  >;
  token: Pick<ISwapToken, 'contractAddress' | 'name' | 'symbol'>;
}) {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return [
    token.symbol,
    token.name,
    token.contractAddress,
    stock?.title,
    stock?.subtitle,
    stock?.underlyingAssetName,
    stock?.underlyingAssetTicker,
  ].some((value) => value?.toLowerCase().includes(normalizedKeyword));
}

export function isSwapStockMetadataPending({
  isSwapStockSelectTarget,
  resolvedStockMetadataTokenKey,
  stockMetadataTokenKey,
}: {
  isSwapStockSelectTarget: boolean;
  resolvedStockMetadataTokenKey?: string;
  stockMetadataTokenKey?: string;
}) {
  return Boolean(
    isSwapStockSelectTarget &&
    stockMetadataTokenKey &&
    resolvedStockMetadataTokenKey !== stockMetadataTokenKey,
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

export function buildSwapTokenSelectorNetworkView({
  type,
  swapTypeSwitch,
  isSwapStockSelectTarget,
  fromToken,
  toToken,
  swapNetworksIncludeAllNetwork,
}: {
  type: ESwapDirectionType;
  swapTypeSwitch: ESwapTabSwitchType;
  isSwapStockSelectTarget: boolean;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  swapNetworksIncludeAllNetwork: ISwapNetwork[];
}) {
  if (swapTypeSwitch !== ESwapTabSwitchType.SWAP || isSwapStockSelectTarget) {
    return {
      sameChainNetwork: undefined,
      networks: swapNetworksIncludeAllNetwork,
    };
  }

  const sameChainNetworkId =
    type === ESwapDirectionType.FROM
      ? toToken?.networkId
      : fromToken?.networkId;
  const sameChainNetwork = swapNetworksIncludeAllNetwork.find(
    (network) =>
      !network.isAllNetworks && network.networkId === sameChainNetworkId,
  );

  if (!sameChainNetwork) {
    return {
      sameChainNetwork: undefined,
      networks: swapNetworksIncludeAllNetwork,
    };
  }

  return {
    sameChainNetwork,
    networks: swapNetworksIncludeAllNetwork.filter(
      (network) => network.networkId !== sameChainNetwork.networkId,
    ),
  };
}

// A pasted address searches every network; keep the selected network's
// matches first and report where the other-network section starts (-1 when
// there is none). Without a selected network the list is returned unchanged.
export function groupSwapSearchTokensBySelectedNetwork<T>({
  tokens,
  selectedNetworkId,
  getNetworkId,
}: {
  tokens: T[];
  selectedNetworkId?: string;
  getNetworkId: (token: T) => string | undefined;
}): { tokens: T[]; otherNetworkStartIndex: number } {
  if (!selectedNetworkId || tokens.length === 0) {
    return { tokens, otherNetworkStartIndex: -1 };
  }
  const selectedNetworkTokens: T[] = [];
  const otherNetworkTokens: T[] = [];
  tokens.forEach((token) => {
    if (getNetworkId(token) === selectedNetworkId) {
      selectedNetworkTokens.push(token);
    } else {
      otherNetworkTokens.push(token);
    }
  });
  if (otherNetworkTokens.length === 0) {
    return { tokens, otherNetworkStartIndex: -1 };
  }
  return {
    tokens: [...selectedNetworkTokens, ...otherNetworkTokens],
    otherNetworkStartIndex: selectedNetworkTokens.length,
  };
}
