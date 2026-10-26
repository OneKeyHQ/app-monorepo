import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
  type IFetchTokenListParams,
  type IFetchTokensParams,
  type ISwapTokenSearchNetwork,
} from '../../types/swap/types';

import networkUtils from './networkUtils';

type ISwapTokenSearchRequest = {
  endpoint: '/swap/v1/tokens' | '/swap/v1/swap-tokens';
  params: IFetchTokenListParams;
};

function isAllNetworkTokenSearch(
  params: Pick<IFetchTokensParams, 'keywords' | 'protocol' | 'networkId'>,
) {
  return (
    Boolean(params.keywords) &&
    params.protocol !== EProtocolOfExchange.STOCK &&
    params.protocol !== ESwapTabSwitchType.STOCK &&
    networkUtils.isAllNetwork({ networkId: params.networkId })
  );
}

function isIncludedSearchNetwork(
  network: ISwapTokenSearchNetwork | undefined,
  lpToken?: boolean,
): network is ISwapTokenSearchNetwork {
  return Boolean(
    network?.networkId &&
    !networkUtils.isAllNetwork({ networkId: network.networkId }) &&
    (!lpToken || network.lpToken === true),
  );
}

export function normalizeSwapTokenSearchNetworks(
  networks?: ISwapTokenSearchNetwork[],
): ISwapTokenSearchNetwork[] {
  const unique = new Map<string, ISwapTokenSearchNetwork>();
  for (const network of networks ?? []) {
    if (
      network.networkId &&
      !networkUtils.isAllNetwork({ networkId: network.networkId }) &&
      !unique.has(network.networkId)
    ) {
      unique.set(network.networkId, {
        networkId: network.networkId,
        lpToken: network.lpToken,
      });
    }
  }
  return Array.from(unique.values()).toSorted((left, right) =>
    left.networkId.localeCompare(right.networkId),
  );
}

export function getSwapTokenSearchContractNetworkId(
  params: Pick<
    IFetchTokensParams,
    | 'keywords'
    | 'protocol'
    | 'networkId'
    | 'lpToken'
    | 'contractSearchNetworkId'
    | 'searchNetworks'
  >,
) {
  if (!isAllNetworkTokenSearch(params)) {
    return params.contractSearchNetworkId;
  }
  const scopedNetwork = normalizeSwapTokenSearchNetworks(
    params.searchNetworks,
  ).find((network) => network.networkId === params.contractSearchNetworkId);
  // A chain already in the fan-out only changes display priority. Keep the
  // identity when the selected chain adds a legacy fallback request instead.
  return isIncludedSearchNetwork(scopedNetwork, params.lpToken)
    ? undefined
    : params.contractSearchNetworkId;
}

export function buildSwapTokenSearchRequests({
  params,
  contractSearchNetworkId,
  searchNetworks,
}: {
  params: IFetchTokenListParams;
  contractSearchNetworkId?: string;
  searchNetworks?: ISwapTokenSearchNetwork[];
}): ISwapTokenSearchRequest[] {
  if (!isAllNetworkTokenSearch(params)) {
    const requests: ISwapTokenSearchRequest[] = [
      { endpoint: '/swap/v1/tokens', params },
    ];
    if (params.keywords && params.onlySwapTokens) {
      requests.push({ endpoint: '/swap/v1/swap-tokens', params });
    }
    return requests;
  }

  const normalizedNetworks = normalizeSwapTokenSearchNetworks(searchNetworks);
  const selectedNetwork = contractSearchNetworkId
    ? (normalizedNetworks.find(
        (network) => network.networkId === contractSearchNetworkId,
      ) ?? { networkId: contractSearchNetworkId })
    : undefined;
  const networks: ISwapTokenSearchNetwork[] = [];
  const includedNetworkIds = new Set<string>();
  for (const network of [selectedNetwork, ...normalizedNetworks]) {
    if (
      isIncludedSearchNetwork(network, params.lpToken) &&
      !includedNetworkIds.has(network.networkId)
    ) {
      networks.push(network);
      includedNetworkIds.add(network.networkId);
    }
  }
  // All-network token search does not resolve chain token metadata reliably.
  // Use each supported chain, with no address or xpub from another network.
  const publicParams: IFetchTokenListParams = {
    ...params,
    accountAddress: undefined,
    accountNetworkId: undefined,
    accountXpub: undefined,
    withCheckInscription: undefined,
    onlyAccountTokens: undefined,
  };
  const requests: ISwapTokenSearchRequest[] = networks.map(
    ({ networkId, lpToken }) => ({
      endpoint: '/swap/v1/tokens',
      params: { ...publicParams, networkId, lpToken },
    }),
  );
  if (!params.lpToken && (params.onlySwapTokens || networks.length === 0)) {
    // Keep cross-chain discovery, including legacy callers without a chain
    // scope. Never fall back to the unreliable all-network tokens endpoint.
    requests.push({
      endpoint: '/swap/v1/swap-tokens',
      params: publicParams,
    });
  }
  return requests;
}
