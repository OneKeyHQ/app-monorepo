import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  ISwapNetwork,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

type ISwapHistoryNetworkToken = Pick<
  ISwapToken,
  'networkId' | 'networkLogoURI'
>;

function isNonEmptyString(value?: string) {
  return Boolean(value?.trim());
}

function isSwapHistoryNetworkComplete({
  network,
  token,
}: {
  network?: ISwapNetwork;
  token: ISwapHistoryNetworkToken;
}) {
  return Boolean(
    token.networkId &&
    network?.networkId === token.networkId &&
    isNonEmptyString(network.name) &&
    isNonEmptyString(network.symbol),
  );
}

export function buildSwapHistoryNetworkPlaceholder(
  token: ISwapHistoryNetworkToken,
): ISwapNetwork {
  return {
    networkId: token.networkId,
    name: '',
    symbol: '',
    shortcode: '',
    logoURI: token.networkLogoURI ?? '',
  };
}

export function buildSwapHistoryNetworkFromServer({
  network,
  token,
}: {
  network: IServerNetwork;
  token: ISwapHistoryNetworkToken;
}): ISwapNetwork {
  return {
    networkId: network.id,
    name: network.name,
    symbol: network.symbol,
    shortcode: network.shortcode,
    logoURI: network.logoURI || token.networkLogoURI || '',
    backendIndex: network.backendIndex,
    isAllNetworks: network.isAllNetworks,
  };
}

function normalizeSwapHistoryNetwork({
  network,
  serverNetwork,
  token,
}: {
  network?: ISwapNetwork;
  serverNetwork?: IServerNetwork;
  token: ISwapHistoryNetworkToken;
}): ISwapNetwork | undefined {
  const canonicalNetworkId = token.networkId;
  if (!canonicalNetworkId) {
    return network;
  }

  if (isSwapHistoryNetworkComplete({ network, token })) {
    return network;
  }

  if (network?.networkId !== canonicalNetworkId) {
    return serverNetwork
      ? buildSwapHistoryNetworkFromServer({ network: serverNetwork, token })
      : buildSwapHistoryNetworkPlaceholder(token);
  }

  const name = network.name || serverNetwork?.name || '';
  const symbol = network.symbol || serverNetwork?.symbol || '';
  const shortcode = network.shortcode || serverNetwork?.shortcode || '';
  const logoURI =
    network.logoURI || serverNetwork?.logoURI || token.networkLogoURI || '';
  const backendIndex = network.backendIndex ?? serverNetwork?.backendIndex;
  const isAllNetworks = network.isAllNetworks ?? serverNetwork?.isAllNetworks;

  if (
    name === network.name &&
    symbol === network.symbol &&
    shortcode === network.shortcode &&
    logoURI === network.logoURI &&
    backendIndex === network.backendIndex &&
    isAllNetworks === network.isAllNetworks
  ) {
    return network;
  }

  return {
    ...network,
    name,
    symbol,
    shortcode,
    logoURI,
    backendIndex,
    isAllNetworks,
  };
}

export function getSwapHistoryNetworkIdsToEnrich(
  histories: readonly ISwapTxHistory[],
) {
  const networkIds = new Set<string>();
  histories.forEach((history) => {
    const { fromNetwork, fromToken, toNetwork, toToken } = history.baseInfo;
    if (
      !isSwapHistoryNetworkComplete({
        network: fromNetwork,
        token: fromToken,
      }) &&
      fromToken.networkId
    ) {
      networkIds.add(fromToken.networkId);
    }
    if (
      !isSwapHistoryNetworkComplete({
        network: toNetwork,
        token: toToken,
      }) &&
      toToken.networkId
    ) {
      networkIds.add(toToken.networkId);
    }
  });
  return [...networkIds];
}

export function normalizeSwapHistoryNetworkInfo({
  histories,
  networks,
}: {
  histories: readonly ISwapTxHistory[];
  networks: readonly IServerNetwork[];
}): { histories: ISwapTxHistory[]; changed: boolean } {
  const serverNetworkMap = new Map(
    networks.map((network) => [network.id, network]),
  );
  let changed = false;
  const normalizedHistories = histories.map((history) => {
    const { fromNetwork, fromToken, toNetwork, toToken } = history.baseInfo;
    const normalizedFromNetwork = normalizeSwapHistoryNetwork({
      network: fromNetwork,
      serverNetwork: serverNetworkMap.get(fromToken.networkId),
      token: fromToken,
    });
    const normalizedToNetwork = normalizeSwapHistoryNetwork({
      network: toNetwork,
      serverNetwork: serverNetworkMap.get(toToken.networkId),
      token: toToken,
    });
    if (
      normalizedFromNetwork === fromNetwork &&
      normalizedToNetwork === toNetwork
    ) {
      return history;
    }
    changed = true;
    return {
      ...history,
      baseInfo: {
        ...history.baseInfo,
        fromNetwork: normalizedFromNetwork,
        toNetwork: normalizedToNetwork,
      },
    };
  });

  return {
    histories: normalizedHistories,
    changed,
  };
}
