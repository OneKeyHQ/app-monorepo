import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IFetchServerTokenListResponse } from '@onekeyhq/shared/types/serverToken';

import {
  applyComposedBalancesToBackendTokenList,
  buildLocalWalletNativeTokenList,
  getLocalWalletFiatValue,
} from './tokenList';

const network = {
  decimals: 12,
  name: 'Monero',
  symbol: 'XMR',
  logoURI: '',
} as IServerNetwork;

function build(params: {
  balance: string;
  balanceParsed: string;
  price?: number;
  price24h?: number;
}) {
  const response = buildLocalWalletNativeTokenList({
    network,
    networkId: 'xmr--0',
    accountAddress: 'own',
    ...params,
  });
  const { tokens } = response.data.data;
  return { tokens, fiat: tokens.map['xmr--0_own_'] };
}

describe('local wallet native token list', () => {
  it('values the balance at the quoted price, row and group alike', () => {
    const { tokens, fiat } = build({
      balance: '2500000000000',
      balanceParsed: '2.5',
      price: 150,
    });
    expect(fiat).toMatchObject({ price: 150, fiatValue: '375' });
    expect(tokens.fiatValue).toBe('375');
  });

  it('leaves fiat unknown without a quote, never $0.00', () => {
    const { tokens, fiat } = build({
      balance: '2500000000000',
      balanceParsed: '2.5',
    });
    // Same as an unpriced backend row: the price shows "--", not $0.00.
    expect(fiat).toMatchObject({ price: null, fiatValue: '' });
    expect(fiat.price24h).toBeUndefined();
    expect(tokens.fiatValue).toBeUndefined();
  });

  it('carries the quote 24h change', () => {
    const { fiat } = build({
      balance: '2500000000000',
      balanceParsed: '2.5',
      price: 150,
      price24h: -2.5,
    });
    expect(fiat).toMatchObject({ price: 150, price24h: -2.5 });
  });

  it.each([undefined, 150])(
    'values a confirmed zero at 0 whatever the quote (%s)',
    (price) => {
      expect(build({ balance: '0', balanceParsed: '0', price }).fiat).toEqual(
        expect.objectContaining({ fiatValue: '0' }),
      );
    },
  );

  it('keeps an unknown balance unknown even with a quote', () => {
    expect(
      build({ balance: '', balanceParsed: '', price: 150 }).fiat.fiatValue,
    ).toBe('');
  });
});

describe('local wallet fiat value', () => {
  it.each([
    ['1.5', 2, '3'],
    ['0', undefined, '0'],
    ['1.5', undefined, ''],
    ['', 2, ''],
  ])('values %s at %s as %s', (amountParsed, price, expected) => {
    expect(getLocalWalletFiatValue({ amountParsed, price })).toBe(expected);
  });
});

describe('applyComposedBalancesToBackendTokenList', () => {
  function createResponse(): IFetchServerTokenListResponse {
    return {
      data: {
        data: {
          tokens: {
            data: [
              {
                $key: 'starknet--mainnet_0x1_0xstrk',
                decimals: 18,
                name: 'Starknet Token',
                symbol: 'STRK',
                address: '0xstrk',
                isNative: true,
              },
              {
                $key: 'starknet--mainnet_0x1_0xeth',
                decimals: 18,
                name: 'Ether',
                symbol: 'ETH',
                address: '0xeth',
                isNative: false,
              },
            ],
            map: {
              'starknet--mainnet_0x1_0xstrk': {
                balance: '1000000000000000000',
                balanceParsed: '1',
                fiatValue: '0.5',
                price: 0.5,
                price24h: 2,
                currency: 'usd',
              },
              'starknet--mainnet_0x1_0xeth': {
                balance: '2000000000000000000',
                balanceParsed: '2',
                fiatValue: '6000',
                price: 3000,
                price24h: -1,
                currency: 'usd',
              },
            },
            keys: 'tokens-keys',
            fiatValue: '6000.5',
          },
          smallBalanceTokens: {
            data: [
              {
                $key: 'starknet--mainnet_0x1_0xusdc',
                decimals: 6,
                name: 'USD Coin',
                symbol: 'USDC',
                address: '0xusdc',
                isNative: false,
              },
            ],
            map: {
              'starknet--mainnet_0x1_0xusdc': {
                balance: '500000',
                balanceParsed: '0.5',
                fiatValue: '0.5',
                price: 1,
                currency: 'usd',
              },
            },
            keys: 'small-keys',
            fiatValue: '0.5',
          },
          riskTokens: { data: [], map: {}, keys: 'risk-keys' },
        },
      },
    };
  }

  it('overlays multiple tokens across groups, recounts group fiatValue, and updates keys', () => {
    const response = createResponse();

    const updated = applyComposedBalancesToBackendTokenList({
      response,
      groups: ['tokens', 'smallBalanceTokens', 'riskTokens'],
      resolveBalance: (token) => {
        if (token.address === '0xstrk') {
          return { total: '5000000000000000000' };
        }
        if (token.address === '0xusdc') {
          return { total: '100500000', frozen: '50000000' };
        }
        return undefined;
      },
    });

    expect(updated).toBe(true);
    expect(
      response.data.data.tokens.map['starknet--mainnet_0x1_0xstrk'],
    ).toMatchObject({
      balance: '5000000000000000000',
      balanceParsed: '5',
      totalBalance: '5000000000000000000',
      totalBalanceParsed: '5',
      fiatValue: '2.5',
      totalBalanceFiatValue: '2.5',
      price: 0.5,
      price24h: 2,
    });
    expect(
      response.data.data.tokens.map['starknet--mainnet_0x1_0xstrk']
        .frozenBalance,
    ).toBeUndefined();
    expect(response.data.data.tokens.fiatValue).toBe('6002.5');
    expect(response.data.data.tokens.keys).not.toBe('tokens-keys');

    expect(
      response.data.data.smallBalanceTokens.map['starknet--mainnet_0x1_0xusdc'],
    ).toMatchObject({
      balance: '100500000',
      balanceParsed: '100.5',
      frozenBalance: '50000000',
      frozenBalanceParsed: '50',
      frozenBalanceFiatValue: '50',
      fiatValue: '100.5',
      totalBalanceFiatValue: '100.5',
    });
    expect(response.data.data.smallBalanceTokens.fiatValue).toBe('100.5');
    expect(response.data.data.smallBalanceTokens.keys).not.toBe('small-keys');
    expect(response.data.data.riskTokens.keys).toBe('risk-keys');
  });

  it('returns false and leaves keys untouched when no token matches', () => {
    const response = createResponse();

    expect(
      applyComposedBalancesToBackendTokenList({
        response,
        resolveBalance: () => undefined,
      }),
    ).toBe(false);
    expect(response.data.data.tokens.keys).toBe('tokens-keys');
    expect(response.data.data.tokens.fiatValue).toBe('6000.5');
  });
});
