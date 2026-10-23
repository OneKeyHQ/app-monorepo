import {
  EProtocolOfExchange,
  type IFetchTokenListParams,
} from '../../types/swap/types';

import {
  buildSwapTokenSearchRequests,
  normalizeSwapTokenSearchNetworks,
} from './swapTokenSearchRequestUtils';

const params: IFetchTokenListParams = {
  protocol: EProtocolOfExchange.SWAP,
  networkId: 'onekeyall--0',
  keywords: 'usdt',
  onlySwapTokens: true,
};

describe('Swap token search request routing', () => {
  it('normalizes a canonical chain scope with first-wins LP flags without mutating inputs', () => {
    const networks = [
      { networkId: 'evm--56', lpToken: false },
      { networkId: 'onekeyall--0', lpToken: true },
      { networkId: '' },
      { networkId: 'evm--1' },
      { networkId: 'evm--56', lpToken: true },
    ];
    expect(normalizeSwapTokenSearchNetworks(networks)).toEqual([
      { networkId: 'evm--1', lpToken: undefined },
      { networkId: 'evm--56', lpToken: false },
    ]);
    expect(networks[0]).toEqual({ networkId: 'evm--56', lpToken: false });
    expect(networks).toHaveLength(5);
    expect(normalizeSwapTokenSearchNetworks()).toEqual([]);
  });

  it('searches unique concrete chains with the selected contract chain first', () => {
    const requests = buildSwapTokenSearchRequests({
      params,
      contractSearchNetworkId: 'evm--56',
      searchNetworks: [
        { networkId: 'evm--1' },
        { networkId: 'evm--56' },
        { networkId: 'evm--1' },
        { networkId: 'onekeyall--0' },
        { networkId: '' },
      ],
    });
    expect(
      requests.map((request) => [request.endpoint, request.params.networkId]),
    ).toEqual([
      ['/swap/v1/tokens', 'evm--56'],
      ['/swap/v1/tokens', 'evm--1'],
      ['/swap/v1/swap-tokens', 'onekeyall--0'],
    ]);
  });

  it('isolates address, xpub and holdings-only flags from cross-chain metadata requests', () => {
    const requests = buildSwapTokenSearchRequests({
      params: {
        ...params,
        accountAddress: 'wrong-chain',
        accountNetworkId: 'btc--0',
        accountXpub: 'wrong-xpub',
        withCheckInscription: true,
        onlyAccountTokens: true,
      },
      searchNetworks: [{ networkId: 'evm--1' }],
    });
    for (const request of requests) {
      expect(request.params).toEqual(
        expect.objectContaining({
          accountAddress: undefined,
          accountNetworkId: undefined,
          accountXpub: undefined,
          withCheckInscription: undefined,
          onlyAccountTokens: undefined,
        }),
      );
    }
  });

  it('uses each chain LP capability and keeps LP-only searches within supported chains', () => {
    const requests = buildSwapTokenSearchRequests({
      params: { ...params, lpToken: false },
      contractSearchNetworkId: 'evm--56',
      searchNetworks: [
        { networkId: 'evm--1' },
        { networkId: 'evm--56', lpToken: false },
      ],
    });
    expect(requests[0].params.lpToken).toBe(false);
    expect(requests[1].params.lpToken).toBeUndefined();
    const lpRequests = buildSwapTokenSearchRequests({
      params: { ...params, lpToken: true },
      contractSearchNetworkId: 'evm--1',
      searchNetworks: [
        { networkId: 'evm--1' },
        { networkId: 'evm--56', lpToken: true },
      ],
    });
    expect(lpRequests).toEqual([
      {
        endpoint: '/swap/v1/tokens',
        params: expect.objectContaining({
          networkId: 'evm--56',
          lpToken: true,
        }),
      },
    ]);
  });

  it('keeps legacy searches on discovery and an optional contract-chain fallback', () => {
    expect(
      buildSwapTokenSearchRequests({
        params: { ...params, onlySwapTokens: undefined },
      }).map((request) => request.endpoint),
    ).toEqual(['/swap/v1/swap-tokens']);
    expect(
      buildSwapTokenSearchRequests({
        params,
        contractSearchNetworkId: 'evm--56',
      }).map((request) => request.params.networkId),
    ).toEqual(['evm--56', 'onekeyall--0']);
    expect(
      buildSwapTokenSearchRequests({ params: { ...params, lpToken: true } }),
    ).toEqual([]);
  });

  it.each([
    { ...params, networkId: 'evm--1' },
    { ...params, keywords: '' },
    { ...params, protocol: EProtocolOfExchange.STOCK },
  ])(
    'preserves the existing single-chain, default and Stock paths (%j)',
    (requestParams) => {
      const requests = buildSwapTokenSearchRequests({
        params: requestParams,
        searchNetworks: [{ networkId: 'evm--56' }],
      });
      expect(requests.map((request) => request.endpoint)).toEqual(
        requestParams.keywords
          ? ['/swap/v1/tokens', '/swap/v1/swap-tokens']
          : ['/swap/v1/tokens'],
      );
      expect(
        requests.every((request) => request.params === requestParams),
      ).toBe(true);
    },
  );
});
