import { buildSwapTokenSearchRequests } from '@onekeyhq/shared/src/utils/swapTokenSearchRequestUtils';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
  type IFetchTokenListParams,
  type IFetchTokensParams,
} from '@onekeyhq/shared/types/swap/types';

import { buildSwapTokenListCacheKey } from './swapTokenSelectorCacheUtils';

const base: IFetchTokensParams = {
  networkId: 'onekeyall--0',
  protocol: ESwapTabSwitchType.SWAP,
  keywords: '0x1234567890123456789012345678901234567890',
  onlySwapTokens: true,
  lpToken: false,
  currency: 'usd',
  searchNetworks: [
    { networkId: 'evm--1', lpToken: false },
    { networkId: 'evm--42161', lpToken: false },
  ],
};

function getHttpRequestSet(params: IFetchTokensParams) {
  const requestParams: IFetchTokenListParams = {
    protocol: EProtocolOfExchange.SWAP,
    networkId: params.networkId,
    keywords: params.keywords,
    onlySwapTokens: params.onlySwapTokens,
    lpToken: params.lpToken,
  };
  return buildSwapTokenSearchRequests({
    params: requestParams,
    searchNetworks: params.searchNetworks,
    contractSearchNetworkId: params.contractSearchNetworkId,
  })
    .map((request) => JSON.stringify(request))
    .toSorted();
}

describe('token selector search request identity', () => {
  it.each([false, true])(
    'shares the key when the selected chain only reorders an identical fan-out (LP %s)',
    (lpToken) => {
      const common = {
        ...base,
        lpToken,
        onlySwapTokens: lpToken ? undefined : true,
        searchNetworks: base.searchNetworks?.map((network) => ({
          ...network,
          lpToken,
        })),
      };
      const ethereum = { ...common, contractSearchNetworkId: 'evm--1' };
      const arbitrum = { ...common, contractSearchNetworkId: 'evm--42161' };
      expect(getHttpRequestSet(ethereum)).toEqual(getHttpRequestSet(arbitrum));
      expect(buildSwapTokenListCacheKey(ethereum)).toBe(
        buildSwapTokenListCacheKey(arbitrum),
      );
      expect(buildSwapTokenListCacheKey(ethereum)).toBe(
        buildSwapTokenListCacheKey(common),
      );
    },
  );

  it('keeps a distinct identity when a selected chain adds a fallback request', () => {
    const knownChain = { ...base, contractSearchNetworkId: 'evm--1' };
    const extraChain = { ...base, contractSearchNetworkId: 'evm--56' };
    expect(getHttpRequestSet(extraChain)).toHaveLength(
      getHttpRequestSet(knownChain).length + 1,
    );
    expect(buildSwapTokenListCacheKey(extraChain)).not.toBe(
      buildSwapTokenListCacheKey(knownChain),
    );
  });

  it.each<Partial<IFetchTokensParams>>([
    { keywords: '' },
    { networkId: 'evm--1' },
    { protocol: ESwapTabSwitchType.STOCK },
    { protocol: EProtocolOfExchange.STOCK },
    { searchNetworks: undefined },
    { searchNetworks: [] },
  ])('preserves the legacy contract identity for %j', (overrides) => {
    const params = { ...base, ...overrides };
    expect(
      buildSwapTokenListCacheKey({
        ...params,
        contractSearchNetworkId: 'evm--1',
      }),
    ).not.toBe(
      buildSwapTokenListCacheKey({
        ...params,
        contractSearchNetworkId: 'evm--42161',
      }),
    );
  });

  it('normalizes network ordering but keeps changes to the actual LP request scope', () => {
    expect(buildSwapTokenListCacheKey(base)).toBe(
      buildSwapTokenListCacheKey({
        ...base,
        searchNetworks: base.searchNetworks?.toReversed(),
      }),
    );
    expect(buildSwapTokenListCacheKey(base)).not.toBe(
      buildSwapTokenListCacheKey({
        ...base,
        searchNetworks: [{ networkId: 'evm--1', lpToken: true }],
      }),
    );
  });
});
