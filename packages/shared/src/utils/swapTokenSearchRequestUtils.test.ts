import {
  EProtocolOfExchange,
  type IFetchTokenListParams,
} from '../../types/swap/types';

import { buildSwapTokenSearchRequests } from './swapTokenSearchRequestUtils';

const params: IFetchTokenListParams = {
  protocol: EProtocolOfExchange.SWAP,
  networkId: 'onekeyall--0',
  keywords: 'usdt',
  onlySwapTokens: true,
};

describe('Swap token search request routing', () => {
  it.each(['usdt', '0x55d398326f99059ff775485246999027b3197955'])(
    'keeps both search endpoints on the aggregate network for %s',
    (keywords) => {
      const requests = buildSwapTokenSearchRequests({
        params: { ...params, keywords },
      });
      expect(
        requests.map((request) => [request.endpoint, request.params.networkId]),
      ).toEqual([
        ['/swap/v1/tokens', 'onekeyall--0'],
        ['/swap/v1/swap-tokens', 'onekeyall--0'],
      ]);
    },
  );

  it('isolates address, xpub and holdings-only flags from aggregate metadata requests', () => {
    const privateParams = {
      ...params,
      accountAddress: 'wrong-chain',
      accountNetworkId: 'btc--0',
      accountXpub: 'wrong-xpub',
      withCheckInscription: true,
      onlyAccountTokens: true,
    };
    const requests = buildSwapTokenSearchRequests({ params: privateParams });
    for (const request of requests) {
      expect(request.params).toEqual(
        expect.objectContaining({
          networkId: 'onekeyall--0',
          accountAddress: undefined,
          accountNetworkId: undefined,
          accountXpub: undefined,
          withCheckInscription: undefined,
          onlyAccountTokens: undefined,
        }),
      );
    }
    expect(privateParams.accountAddress).toBe('wrong-chain');
    expect(privateParams.accountXpub).toBe('wrong-xpub');
  });

  it.each([undefined, false, true])(
    'keeps the aggregate LP filter unchanged (%s)',
    (lpToken) => {
      const requestParams = { ...params, onlySwapTokens: undefined, lpToken };
      expect(buildSwapTokenSearchRequests({ params: requestParams })).toEqual([
        {
          endpoint: '/swap/v1/tokens',
          params: expect.objectContaining({
            networkId: 'onekeyall--0',
            lpToken,
          }),
        },
      ]);
    },
  );

  it.each([
    { ...params, networkId: 'evm--1' },
    { ...params, keywords: '' },
    { ...params, protocol: EProtocolOfExchange.STOCK },
  ])(
    'preserves the existing single-chain, default and Stock paths (%j)',
    (requestParams) => {
      const requests = buildSwapTokenSearchRequests({ params: requestParams });
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
