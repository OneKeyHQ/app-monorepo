import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { USDC_TOKEN_INFO } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  buildPerpsDepositTokensByNetwork,
  buildPerpsDepositTokensFromWalletTokenResponses,
  getDefaultPerpsDepositToken,
  resolvePerpsDepositSelectedToken,
} from './depositTokenListUtils';

const makeToken = (
  overrides: Partial<IAccountToken> & {
    networkId: string;
    address: string;
    symbol: string;
  },
): IAccountToken => {
  const { networkId, address, symbol, ...rest } = overrides;
  return {
    $key: `${networkId}_${address}`,
    decimals: 18,
    name: symbol,
    symbol,
    address,
    networkId,
    isNative: false,
    logoURI: `${symbol}.png`,
    ...rest,
  };
};

const makeFiat = (overrides: Partial<ITokenFiat> = {}): ITokenFiat => ({
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: 0,
  ...overrides,
});

const makeResponse = ({
  tokens,
  tokenMap,
  smallBalanceTokens = [],
  riskTokens = [],
}: {
  tokens: IAccountToken[];
  tokenMap: Record<string, ITokenFiat>;
  smallBalanceTokens?: IAccountToken[];
  riskTokens?: IAccountToken[];
}): IFetchAccountTokensResp => ({
  tokens: {
    data: tokens,
    keys: tokens.map((token) => token.$key).join(','),
    map: tokenMap,
  },
  smallBalanceTokens: {
    data: smallBalanceTokens,
    keys: smallBalanceTokens.map((token) => token.$key).join(','),
    map: Object.fromEntries(
      smallBalanceTokens.map((token) => [token.$key, makeFiat()]),
    ),
  },
  riskTokens: {
    data: riskTokens,
    keys: riskTokens.map((token) => token.$key).join(','),
    map: Object.fromEntries(
      riskTokens.map((token) => [token.$key, makeFiat()]),
    ),
  },
});

describe('depositTokenListUtils', () => {
  it('maps only wallet home visible tokens and excludes small balance and risky tokens', () => {
    const eth = makeToken({
      networkId: 'evm--1',
      address: '',
      symbol: 'ETH',
      isNative: true,
      decimals: 18,
      name: 'Ethereum',
    });
    const arbUsdc = makeToken({
      networkId: PERPS_NETWORK_ID,
      address: USDC_TOKEN_INFO.address,
      symbol: 'USDC',
      decimals: USDC_TOKEN_INFO.decimals,
      name: USDC_TOKEN_INFO.name,
    });
    const smallSol = makeToken({
      networkId: 'sol--101',
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
    });
    const risky = makeToken({
      networkId: 'evm--137',
      address: '0xrisky',
      symbol: 'RISK',
    });

    const result = buildPerpsDepositTokensFromWalletTokenResponses({
      responses: [
        makeResponse({
          tokens: [eth, arbUsdc],
          smallBalanceTokens: [smallSol],
          riskTokens: [risky],
          tokenMap: {
            [eth.$key]: makeFiat({
              balanceParsed: '0.1623',
              fiatValue: '257.04',
              price: 1583,
            }),
            [arbUsdc.$key]: makeFiat({
              balanceParsed: '24.9523',
              fiatValue: '24.94',
              price: 1,
            }),
          },
        }),
      ],
      networkLogoURIByNetworkId: {
        'evm--1': 'eth-network.png',
        [PERPS_NETWORK_ID]: 'arbitrum-network.png',
      },
    });

    expect(result).toEqual([
      expect.objectContaining({
        networkId: 'evm--1',
        contractAddress: '',
        symbol: 'ETH',
        balanceParsed: '0.1623',
        fiatValue: '257.04',
        price: '1583',
        networkLogoURI: 'eth-network.png',
        isNative: true,
      }),
      expect.objectContaining({
        networkId: PERPS_NETWORK_ID,
        contractAddress: USDC_TOKEN_INFO.address,
        symbol: 'USDC',
        balanceParsed: '24.9523',
        fiatValue: '24.94',
        price: '1',
        networkLogoURI: 'arbitrum-network.png',
      }),
    ]);
    expect(result.map((token) => token.symbol)).not.toContain('SOL');
    expect(result.map((token) => token.symbol)).not.toContain('RISK');
  });

  it('sorts wallet tokens by fiat value descending and keeps stable order for equal values', () => {
    const first = makeToken({
      networkId: 'evm--1',
      address: '0xfirst',
      symbol: 'FIRST',
    });
    const second = makeToken({
      networkId: 'evm--137',
      address: '0xsecond',
      symbol: 'SECOND',
    });
    const third = makeToken({
      networkId: 'sol--101',
      address: 'third',
      symbol: 'THIRD',
    });

    const result = buildPerpsDepositTokensFromWalletTokenResponses({
      responses: [
        makeResponse({
          tokens: [first, second, third],
          tokenMap: {
            [first.$key]: makeFiat({ fiatValue: '10', price: 1 }),
            [second.$key]: makeFiat({ fiatValue: '20', price: 1 }),
            [third.$key]: makeFiat({ fiatValue: '10', price: 1 }),
          },
        }),
      ],
      networkLogoURIByNetworkId: {},
    });

    expect(result.map((token) => token.symbol)).toEqual([
      'SECOND',
      'FIRST',
      'THIRD',
    ]);
  });

  it('maps fiat data when wallet token map keys do not exactly match token $key', () => {
    const arbUsdc = makeToken({
      networkId: PERPS_NETWORK_ID,
      address: USDC_TOKEN_INFO.address,
      symbol: 'USDC',
      decimals: USDC_TOKEN_INFO.decimals,
      name: USDC_TOKEN_INFO.name,
      $key: 'wallet-usdc-key',
    });

    const result = buildPerpsDepositTokensFromWalletTokenResponses({
      responses: [
        makeResponse({
          tokens: [arbUsdc],
          tokenMap: {
            [`wallet:${PERPS_NETWORK_ID}:${USDC_TOKEN_INFO.address.toLowerCase()}`]:
              makeFiat({
                balanceParsed: '24.9523',
                fiatValue: '24.94',
                price: 1,
              }),
          },
        }),
      ],
      networkLogoURIByNetworkId: {},
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        symbol: 'USDC',
        balanceParsed: '24.9523',
        fiatValue: '24.94',
        price: '1',
      }),
    );
  });

  it('does not fuzzy match another network when token map keys share network prefixes', () => {
    const ethToken = makeToken({
      networkId: 'evm--1',
      address: '0xabc',
      symbol: 'TOKEN',
      $key: 'missing-token-key',
    });

    const result = buildPerpsDepositTokensFromWalletTokenResponses({
      responses: [
        makeResponse({
          tokens: [ethToken],
          tokenMap: {
            'wallet:evm--10:0xabc': makeFiat({
              balanceParsed: '10',
              fiatValue: '10',
              price: 1,
            }),
            'wallet:evm--137:0xabc': makeFiat({
              balanceParsed: '137',
              fiatValue: '137',
              price: 1,
            }),
          },
        }),
      ],
      networkLogoURIByNetworkId: {},
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        symbol: 'TOKEN',
        balanceParsed: undefined,
        fiatValue: undefined,
        price: undefined,
      }),
    );
  });

  it('groups tokens by network and picks Arbitrum USDC as the default token', () => {
    const eth = makeToken({
      networkId: 'evm--1',
      address: '',
      symbol: 'ETH',
      isNative: true,
    });
    const arbUsdc = makeToken({
      networkId: PERPS_NETWORK_ID,
      address: USDC_TOKEN_INFO.address.toLowerCase(),
      symbol: 'USDC',
      decimals: USDC_TOKEN_INFO.decimals,
      name: USDC_TOKEN_INFO.name,
    });
    const depositTokens = buildPerpsDepositTokensFromWalletTokenResponses({
      responses: [
        makeResponse({
          tokens: [eth, arbUsdc],
          tokenMap: {
            [eth.$key]: makeFiat({ fiatValue: '100', price: 1000 }),
            [arbUsdc.$key]: makeFiat({ fiatValue: '50', price: 1 }),
          },
        }),
      ],
      networkLogoURIByNetworkId: {},
    });

    expect(buildPerpsDepositTokensByNetwork(depositTokens)).toEqual({
      'evm--1': [expect.objectContaining({ symbol: 'ETH' })],
      [PERPS_NETWORK_ID]: [expect.objectContaining({ symbol: 'USDC' })],
    });
    expect(getDefaultPerpsDepositToken({ tokens: depositTokens })).toEqual(
      expect.objectContaining({
        networkId: PERPS_NETWORK_ID,
        contractAddress: USDC_TOKEN_INFO.address.toLowerCase(),
      }),
    );
  });

  it('uses server default tokens before the legacy Arbitrum USDC fallback', () => {
    const bnb = makeToken({
      networkId: 'evm--56',
      address: '',
      symbol: 'BNB',
      isNative: true,
    });
    const arbUsdc = makeToken({
      networkId: PERPS_NETWORK_ID,
      address: USDC_TOKEN_INFO.address,
      symbol: 'USDC',
      decimals: USDC_TOKEN_INFO.decimals,
      name: USDC_TOKEN_INFO.name,
    });
    const depositTokens = buildPerpsDepositTokensFromWalletTokenResponses({
      responses: [
        makeResponse({
          tokens: [arbUsdc, bnb],
          tokenMap: {
            [arbUsdc.$key]: makeFiat({ fiatValue: '50', price: 1 }),
            [bnb.$key]: makeFiat({
              balanceParsed: '1.2',
              fiatValue: '720',
              price: 600,
            }),
          },
        }),
      ],
      networkLogoURIByNetworkId: {},
    });

    expect(
      resolvePerpsDepositSelectedToken({
        tokens: depositTokens,
        defaultTokens: [
          {
            networkId: 'evm--56',
            contractAddress: '',
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
            networkLogoURI: '',
            isNative: true,
            isDefault: true,
          },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        networkId: 'evm--56',
        symbol: 'BNB',
        balanceParsed: '1.2',
      }),
    );
  });

  it('uses token isDefault before external default token hints', () => {
    const bnb = {
      networkId: 'evm--56',
      contractAddress: '',
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
      networkLogoURI: '',
      isNative: true,
      isDefault: true,
    };
    const tron = {
      networkId: 'tron--0x2b6653dc',
      contractAddress: '',
      name: 'TRON',
      symbol: 'TRX',
      decimals: 6,
      networkLogoURI: '',
      isNative: true,
    };

    expect(
      getDefaultPerpsDepositToken({
        tokens: [bnb, tron],
        defaultTokens: [tron],
      }),
    ).toEqual(expect.objectContaining({ symbol: 'BNB' }));
  });

  it('keeps the current selected token when it still exists in the refreshed wallet list', () => {
    const eth = makeToken({
      networkId: 'evm--1',
      address: '',
      symbol: 'ETH',
      isNative: true,
    });
    const arbUsdc = makeToken({
      networkId: PERPS_NETWORK_ID,
      address: USDC_TOKEN_INFO.address,
      symbol: 'USDC',
      decimals: USDC_TOKEN_INFO.decimals,
      name: USDC_TOKEN_INFO.name,
    });
    const depositTokens = buildPerpsDepositTokensFromWalletTokenResponses({
      responses: [
        makeResponse({
          tokens: [eth, arbUsdc],
          tokenMap: {
            [eth.$key]: makeFiat({
              balanceParsed: '0.2',
              fiatValue: '300',
              price: 1500,
            }),
            [arbUsdc.$key]: makeFiat({
              balanceParsed: '24.9523',
              fiatValue: '24.94',
              price: 1,
            }),
          },
        }),
      ],
      networkLogoURIByNetworkId: {},
    });

    expect(
      resolvePerpsDepositSelectedToken({
        tokens: depositTokens,
        currentToken: {
          networkId: 'evm--1',
          contractAddress: '',
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
          networkLogoURI: '',
          isNative: true,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        symbol: 'ETH',
        balanceParsed: '0.2',
        fiatValue: '300',
      }),
    );
  });
});
