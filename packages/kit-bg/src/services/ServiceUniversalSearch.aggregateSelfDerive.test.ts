/*
yarn test packages/kit-bg/src/services/ServiceUniversalSearch.aggregateSelfDerive.test.ts

Regression guard for PR-3 D2=B1 (tokenList cells full-delete):
UniversalSearch.tsx no longer threads the home `aggregateTokensListMapAtom`
into the BG search params (`aggregateTokenListCacheMap` is now `undefined`).
The BG `universalSearchOfAccountAssets` MUST self-derive the scoped owned
sub-token list map (via `serviceToken.getLocalAggregateTokenListMap`) so that
searching by an OWNED sub-token's contract address still surfaces the
aggregate token (tokenUtils `getFilteredTokenBySearchKey` lines 248-260).
*/

// --- mocks MUST be defined before importing ServiceUniversalSearch ---

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    // cache path only — keep it off the all-network branch
    isAllNetwork: () => false,
  },
}));

// eslint-disable-next-line import/first
import type { IAccountToken } from '@onekeyhq/shared/types/token';

// eslint-disable-next-line import/first
import ServiceUniversalSearch from './ServiceUniversalSearch';

const AGG_KEY = 'evm--1_agg-usdc';
const SUB_ADDRESS = '0xSUBTOKENADDRESS';

function makeAggregateToken(): IAccountToken {
  return {
    $key: AGG_KEY,
    address: '',
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
    isAggregateToken: true,
  } as unknown as IAccountToken;
}

function makeSubToken(): IAccountToken {
  return {
    $key: 'evm--1_sub-usdc',
    address: SUB_ADDRESS,
    networkId: 'evm--1',
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  } as unknown as IAccountToken;
}

function makeService(getLocalAggregateTokenListMap: jest.Mock) {
  const backgroundApi = {
    serviceToken: {
      getLocalAggregateTokenListMap,
      abortFetchAccountTokens: jest.fn().mockResolvedValue(undefined),
    },
  };
  const Ctor = ServiceUniversalSearch as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceUniversalSearch;
  return new Ctor({ backgroundApi });
}

describe('universalSearchOfAccountAssets — BG self-derives aggregate map', () => {
  test('surfaces aggregate token when searching by an owned sub-token address (cache map absent)', async () => {
    const aggToken = makeAggregateToken();
    const getLocalAggregateTokenListMap = jest.fn().mockResolvedValue({
      [AGG_KEY]: { tokens: [makeSubToken()] },
    });
    const svc = makeService(getLocalAggregateTokenListMap);

    const result = await svc.universalSearchOfAccountAssets({
      input: SUB_ADDRESS,
      networkId: 'evm--1',
      accountId: 'hd-1--0',
      indexedAccountId: 'hd-1',
      tokenListCache: [aggToken],
      tokenListCacheMap: { [AGG_KEY]: { balance: '0' } as any },
      // PR-3: UI no longer threads this; BG must self-derive.
      aggregateTokenListCacheMap: undefined,
    });

    // BG must have self-derived the scoped map for the searched owner.
    expect(getLocalAggregateTokenListMap).toHaveBeenCalledWith({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
    });
    // The aggregate token is surfaced via its owned sub-token's address.
    expect(result.tokens.map((t) => t.$key)).toContain(AGG_KEY);
  });

  test('without self-derive the sub-token-address query would NOT surface the aggregate token (proves the guard matters)', async () => {
    const aggToken = makeAggregateToken();
    // Empty derived map => the sub-token address is unknown => no match.
    const getLocalAggregateTokenListMap = jest.fn().mockResolvedValue({});
    const svc = makeService(getLocalAggregateTokenListMap);

    const result = await svc.universalSearchOfAccountAssets({
      input: SUB_ADDRESS,
      networkId: 'evm--1',
      accountId: 'hd-1--0',
      indexedAccountId: 'hd-1',
      tokenListCache: [aggToken],
      tokenListCacheMap: { [AGG_KEY]: { balance: '0' } as any },
      aggregateTokenListCacheMap: undefined,
    });

    expect(result.tokens.map((t) => t.$key)).not.toContain(AGG_KEY);
  });
});
