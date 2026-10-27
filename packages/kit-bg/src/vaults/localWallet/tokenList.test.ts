import type { IServerNetwork } from '@onekeyhq/shared/types';

import {
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
    expect(fiat).toMatchObject({ price: 0, fiatValue: '' });
    expect(tokens.fiatValue).toBeUndefined();
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
