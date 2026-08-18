import { ETokenDappType } from '@onekeyhq/shared/types/token';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { selectHardwarePortfolioTokens } from './selectHardwarePortfolioTokens';

function makeToken(
  key: string,
  overrides: Partial<IAccountToken> = {},
): IAccountToken {
  return {
    $key: key,
    address: `0x${key}`,
    decimals: 18,
    isNative: false,
    name: key,
    networkId: 'evm--1',
    symbol: key.toUpperCase(),
    ...overrides,
  };
}

function makeFiat(overrides: Partial<ITokenFiat> = {}): ITokenFiat {
  return {
    balance: '1',
    balanceParsed: '1',
    fiatValue: '10',
    price: 1,
    ...overrides,
  };
}

describe('selectHardwarePortfolioTokens', () => {
  it('keeps funded tokens and drops zero-balance tokens', () => {
    const funded = makeToken('funded');
    const empty = makeToken('empty');

    expect(
      selectHardwarePortfolioTokens({
        keepDefault: true,
        tokenMap: {
          empty: makeFiat({ balance: '0', balanceParsed: '0', fiatValue: '0' }),
          funded: makeFiat(),
        },
        tokens: [funded, empty],
      }).map((token) => token.$key),
    ).toEqual(['funded']);
  });

  it('uses balance, not balanceParsed, to match home hideZero', () => {
    const dust = makeToken('dust');

    expect(
      selectHardwarePortfolioTokens({
        keepDefault: true,
        tokenMap: {
          dust: makeFiat({
            balance: '0',
            balanceParsed: '0.0001',
            fiatValue: '0',
          }),
        },
        tokens: [dust],
      }),
    ).toEqual([]);
  });

  it('drops DeFi-marked tokens even when they have a balance', () => {
    const walletToken = makeToken('usdc');
    const defiToken = makeToken('lp', {
      dappName: 'uniswap',
      defiMarked: true,
    });

    expect(
      selectHardwarePortfolioTokens({
        keepDefault: true,
        tokenMap: {
          lp: makeFiat(),
          usdc: makeFiat(),
        },
        tokens: [walletToken, defiToken],
      }).map((token) => token.$key),
    ).toEqual(['usdc']);
  });

  it('keeps wallet-typed tokens that happen to carry a dappName', () => {
    const walletToken = makeToken('eth', {
      dappName: 'wallet',
      dappType: ETokenDappType.WalletToken,
      isNative: true,
    });

    expect(
      selectHardwarePortfolioTokens({
        keepDefault: true,
        tokenMap: {
          eth: makeFiat(),
        },
        tokens: [walletToken],
      }).map((token) => token.$key),
    ).toEqual(['eth']);
  });

  it('keeps a zero-balance default native when keepDefault is on', () => {
    const native = makeToken('eth', {
      isNative: true,
      symbol: 'ETH',
    });
    const homeDefaultTokenMap: Record<string, IHomeDefaultToken> = {
      'evm--1_ETH': {
        logoURI: '',
        networkId: 'evm--1',
        order: 0,
        symbol: 'ETH',
      },
    };

    expect(
      selectHardwarePortfolioTokens({
        homeDefaultTokenMap,
        keepDefault: true,
        tokenMap: {
          eth: makeFiat({ balance: '0', balanceParsed: '0', fiatValue: '0' }),
        },
        tokens: [native],
      }).map((token) => token.$key),
    ).toEqual(['eth']);
  });

  it('keeps a zero-balance custom token when keepDefault is on', () => {
    const custom = makeToken('custom');
    const customTokens: ICustomTokenItem[] = [custom];

    expect(
      selectHardwarePortfolioTokens({
        customTokens,
        keepDefault: true,
        tokenMap: {
          custom: makeFiat({
            balance: '0',
            balanceParsed: '0',
            fiatValue: '0',
          }),
        },
        tokens: [custom],
      }).map((token) => token.$key),
    ).toEqual(['custom']);
  });

  it('does not keep a zero-balance default native when keepDefault is off', () => {
    const native = makeToken('eth', {
      isNative: true,
      symbol: 'ETH',
    });

    expect(
      selectHardwarePortfolioTokens({
        homeDefaultTokenMap: {
          'evm--1_ETH': {
            logoURI: '',
            networkId: 'evm--1',
            order: 0,
            symbol: 'ETH',
          },
        },
        keepDefault: false,
        tokenMap: {
          eth: makeFiat({ balance: '0', balanceParsed: '0', fiatValue: '0' }),
        },
        tokens: [native],
      }),
    ).toEqual([]);
  });
});
