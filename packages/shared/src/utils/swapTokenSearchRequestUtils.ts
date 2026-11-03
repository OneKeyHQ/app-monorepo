import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
  type IFetchTokenListParams,
} from '../../types/swap/types';

import networkUtils from './networkUtils';

type ISwapTokenSearchRequest = {
  endpoint: '/swap/v1/tokens' | '/swap/v1/swap-tokens';
  params: IFetchTokenListParams;
};

export function buildSwapTokenSearchRequests({
  params,
}: {
  params: IFetchTokenListParams;
}): ISwapTokenSearchRequest[] {
  // All-network search stays on the server's aggregate scope. Never attach
  // one chain's account or holdings-only flags to this public search.
  const requestParams =
    params.keywords &&
    params.protocol !== EProtocolOfExchange.STOCK &&
    params.protocol !== ESwapTabSwitchType.STOCK &&
    networkUtils.isAllNetwork({ networkId: params.networkId })
      ? {
          ...params,
          accountAddress: undefined,
          accountNetworkId: undefined,
          accountXpub: undefined,
          withCheckInscription: undefined,
          onlyAccountTokens: undefined,
        }
      : params;
  const requests: ISwapTokenSearchRequest[] = [
    { endpoint: '/swap/v1/tokens', params: requestParams },
  ];
  if (params.keywords && params.onlySwapTokens) {
    requests.push({ endpoint: '/swap/v1/swap-tokens', params: requestParams });
  }
  return requests;
}
