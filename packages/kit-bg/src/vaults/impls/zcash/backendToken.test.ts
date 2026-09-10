import type {
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';

import {
  applyZcashBalanceToBackendTokenDetails,
  applyZcashBalanceToBackendTokenList,
} from './backendToken';

const balance = {
  total: '300000000',
  spendable: '125000000',
  frozen: '175000000',
  publicSideSource: 'indexer' as const,
};

function tokenListResponse(): IFetchServerTokenListResponse {
  return {
    data: {
      data: {
        tokens: {
          data: [
            {
              $key: 'zec--0_account_',
              decimals: 8,
              name: 'Zcash',
              symbol: 'ZEC',
              address: '',
              isNative: true,
            },
          ],
          map: {
            'zec--0_account_': {
              balance: '100000000',
              balanceParsed: '1',
              fiatValue: '2',
              price: 2,
              price24h: 1,
              currency: 'usd',
            },
          },
          keys: 'server-keys',
          fiatValue: '2',
        },
        riskTokens: { data: [], map: {}, keys: 'risk' },
        smallBalanceTokens: { data: [], map: {}, keys: 'small' },
      },
    },
  };
}

function tokenDetailResponse(): IFetchServerTokenDetailResponse {
  return {
    data: {
      data: [
        {
          info: {
            decimals: 8,
            name: 'Zcash',
            symbol: 'ZEC',
            address: '',
            isNative: true,
          },
          balance: '100000000',
          balanceParsed: '1',
          fiatValue: '2',
          price: 2,
          price24h: 1,
          currency: 'usd',
        },
      ],
    },
  };
}

describe('Zcash backend token composition', () => {
  it('keeps backend pricing metadata while composing public and private balance', () => {
    const response = tokenListResponse();

    expect(
      applyZcashBalanceToBackendTokenList({
        response,
        balance,
        decimals: 8,
      }),
    ).toBe(true);
    expect(response.data.data.tokens.map['zec--0_account_']).toMatchObject({
      balance: '300000000',
      balanceParsed: '3',
      frozenBalance: '175000000',
      frozenBalanceParsed: '1.75',
      totalBalance: '300000000',
      totalBalanceParsed: '3',
      fiatValue: '6',
      frozenBalanceFiatValue: '3.5',
      totalBalanceFiatValue: '6',
      price: 2,
      price24h: 1,
      currency: 'usd',
    });
    expect(response.data.data.tokens.keys).not.toBe('server-keys');
  });

  it('uses runtime spendability but keeps backend pricing for send details', () => {
    const response = tokenDetailResponse();

    expect(
      applyZcashBalanceToBackendTokenDetails({
        response,
        balance,
        decimals: 8,
      }),
    ).toBe(true);
    expect(response.data.data[0]).toMatchObject({
      balance: '125000000',
      balanceParsed: '1.25',
      frozenBalance: '175000000',
      frozenBalanceParsed: '1.75',
      totalBalance: '300000000',
      totalBalanceParsed: '3',
      fiatValue: '2.5',
      frozenBalanceFiatValue: '3.5',
      totalBalanceFiatValue: '6',
      price: 2,
      price24h: 1,
      currency: 'usd',
    });
  });

  it('leaves responses without a native token untouched', () => {
    const listResponse = tokenListResponse();
    listResponse.data.data.tokens.data[0].isNative = false;
    listResponse.data.data.tokens.data[0].address = 'token';
    const detailResponse = tokenDetailResponse();
    detailResponse.data.data[0].info.isNative = false;
    detailResponse.data.data[0].info.address = 'token';

    expect(
      applyZcashBalanceToBackendTokenList({
        response: listResponse,
        balance,
        decimals: 8,
      }),
    ).toBe(false);
    expect(
      applyZcashBalanceToBackendTokenDetails({
        response: detailResponse,
        balance,
        decimals: 8,
      }),
    ).toBe(false);
  });
});
