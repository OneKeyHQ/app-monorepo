import type {
  IBorrowMarketItem,
  IStakeProtocolListItem,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  EARN_ROUTER_SWAP_IDLE,
  earnRouterSwapReducer,
  findOffer,
  findPayToken,
  getEarnSwapDepositAmount,
  getEarnSwapFeeUsd,
  getEarnSwapMinutes,
  getEarnSwapPayMax,
  getEarnSwapSlippage,
  getPayTokenAddress,
  isEarnBridge,
  isUsableEarnSwapQuote,
  keepPendleMarketRows,
  listPayTokens,
  listPayTokensAcrossNetworks,
  listWithPayTokens,
  matchesPayTokenKeyword,
  mergePickedPayTokens,
  pickBetterOffer,
  pickDefaultPayToken,
  pickDefaultPayTokenAcrossNetworks,
  resolvePayMode,
  toPickedPayToken,
  withPickedTokenDetails,
} from './earnRouter.utils';

import type {
  IEarnRouterPayToken,
  IEarnRouterSwapAction,
  IEarnRouterSwapState,
} from './earnRouter.utils';
import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopWalletTokenGroup,
} from '../../components/desktopHome/earnDesktopHome.utils';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDE = '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3';
const SKY_DOLLAR = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

const walletToken = (
  symbol: string,
  key: string,
  extra: Partial<IAccountToken> = {},
): IAccountToken => ({
  $key: key,
  symbol,
  name: symbol,
  address: key,
  decimals: 6,
  isNative: false,
  ...extra,
});

const walletFiat = (
  balanceParsed: string,
  fiatValue: string,
  extra: Partial<ITokenFiat> = {},
): ITokenFiat => ({
  balance: balanceParsed,
  balanceParsed,
  fiatValue,
  price: 1,
  currency: 'usd',
  ...extra,
});

const eth = walletToken('ETH', 'eth', {
  address: '',
  isNative: true,
  decimals: 18,
});

// The 10-21 test wallet on Ethereum
const ethereumWallet: IEarnDesktopWalletTokenGroup = {
  tokens: [
    eth,
    walletToken('USDT', USDT),
    walletToken('USDS', SKY_DOLLAR, { decimals: 18 }),
    walletToken('USDC', USDC),
    walletToken('USDe', USDE, { decimals: 18 }),
  ],
  map: {
    eth: walletFiat('0.000723', '1.76', { price: 2434.3 }),
    [USDT]: walletFiat('0.8337', '0.8335', { price: 0.9998 }),
    [SKY_DOLLAR]: walletFiat('1.7666', '1.7664', { price: 0.9999 }),
    [USDC]: walletFiat('4.025784', '4.02', { price: 0.9998 }),
    [USDE]: walletFiat('2.2739', '2.2728', { price: 0.9995 }),
  },
};

describe('listPayTokens', () => {
  it('puts the deposit token first, then the most valuable', () => {
    expect(
      listPayTokens({ group: ethereumWallet, depositSymbol: 'USDe' }).map(
        (item) => [item.token.symbol, item.fiatValueUsd, item.isDepositToken],
      ),
    ).toEqual([
      ['USDe', '2.2728', true],
      ['USDC', '4.02', false],
      ['USDS', '1.7664', false],
      ['ETH', '1.76', false],
      ['USDT', '0.8335', false],
    ]);
  });

  it('matches the deposit token by symbol in any case', () => {
    const tokens = listPayTokens({
      group: ethereumWallet,
      depositSymbol: 'usdt',
    });
    expect(
      tokens
        .filter((item) => item.isDepositToken)
        .map((item) => item.token.symbol),
    ).toEqual(['USDT']);
    expect(tokens[0].token.symbol).toBe('USDT');
  });

  it('carries the balance, its value and the price of a unit', () => {
    expect(
      listPayTokens({ group: ethereumWallet, depositSymbol: 'USDC' }).find(
        (item) => item.key === 'eth',
      ),
    ).toEqual({
      key: 'eth',
      token: eth,
      networkId: '',
      amount: '0.000723',
      fiatValueUsd: '1.76',
      priceUsd: '2434.3',
      isDepositToken: false,
    });
  });

  it('keeps the amount but not a value in another currency', () => {
    // An entry that names no currency is on the cache's USD basis
    const tokens = listPayTokens({
      group: {
        tokens: [
          walletToken('EURC', 'euro'),
          walletToken('USDC', 'usdc'),
          walletToken('DAI', 'dai'),
        ],
        map: {
          euro: walletFiat('2', '1.8', { currency: 'eur', price: 0.9 }),
          usdc: walletFiat('1', '1'),
          dai: walletFiat('0.5', '0.5', { currency: undefined }),
        },
      },
      depositSymbol: 'USDe',
    });
    expect(
      tokens.map((item) => [
        item.token.symbol,
        item.amount,
        item.fiatValueUsd,
        item.priceUsd,
      ]),
    ).toEqual([
      ['USDC', '1', '1', '1'],
      ['DAI', '0.5', '0.5', '1'],
      ['EURC', '2', '0', '0'],
    ]);
  });

  it('leaves out DeFi positions, shared-balance twins, tokens without fiat and empty balances', () => {
    const tokens = listPayTokens({
      group: {
        tokens: [
          walletToken('aEthUSDC', 'a_usdc', { defiMarked: true }),
          walletToken('USDC', 'usdc_twin'),
          walletToken('USDC', 'usdc'),
          walletToken('PEPE', 'pepe'),
          walletToken('DAI', 'dai'),
        ],
        map: {
          a_usdc: walletFiat('3', '3'),
          usdc_twin: walletFiat('4.025784', '4.02', {
            sharedBalanceExcludedFromTotal: true,
          }),
          usdc: walletFiat('4.025784', '4.02'),
          dai: walletFiat('0', '0'),
        },
      },
      depositSymbol: 'USDC',
    });
    expect(tokens.map((item) => item.key)).toEqual(['usdc']);
  });

  it('scales a rebase balance, whose value is already scaled', () => {
    // xStocks on Solana; the multiplier sits on the fiat entry or the token
    const tokens = listPayTokens({
      group: {
        tokens: [
          walletToken('TSLAx', 'tesla'),
          walletToken('AAPLx', 'apple', { balanceMultiplier: '1.25' }),
        ],
        map: {
          tesla: walletFiat('2', '900', {
            balanceMultiplier: '1.5',
            price: 300,
          }),
          apple: walletFiat('4', '1132.5', { price: 226.5 }),
        },
      },
      depositSymbol: 'USDC',
    });
    expect(
      tokens.map((item) => [item.token.symbol, item.amount, item.fiatValueUsd]),
    ).toEqual([
      ['AAPLx', '5', '1132.5'],
      ['TSLAx', '3', '900'],
    ]);
  });

  it('given the symbols Earn lists, keeps only those and the network coin', () => {
    // The test wallet's receipt tokens, PT and Curve LP already earn somewhere
    const group: IEarnDesktopWalletTokenGroup = {
      tokens: [
        ...ethereumWallet.tokens,
        walletToken('aEthUSDC', 'aave_usdc'),
        walletToken('sUSDe', 'staked_usde'),
        walletToken('cvxcrv-crv-f', 'curve_lp'),
        walletToken('PT-sUSDE-26NOV2026', 'pendle_pt'),
        walletToken('fUSDC', 'fluid_usdc'),
        walletToken('sUSDC', 'spark_usdc'),
        walletToken('spUSDT', 'spark_usdt'),
        walletToken('syrupUSDC', 'maple_usdc'),
      ],
      map: {
        ...ethereumWallet.map,
        aave_usdc: walletFiat('2.90', '2.90'),
        staked_usde: walletFiat('2.2748', '2.2748'),
        curve_lp: walletFiat('14.97', '2.59'),
        pendle_pt: walletFiat('1.7292', '1.7292'),
        fluid_usdc: walletFiat('1.1637', '1.1637'),
        spark_usdc: walletFiat('1.2768', '1.2768'),
        spark_usdt: walletFiat('0.9106', '0.9106'),
        maple_usdc: walletFiat('0.6406', '0.6406'),
      },
    };
    const payableSymbols = new Set(['usdc', 'usde', 'usds', 'usdt']);
    expect(
      listPayTokens({ group, depositSymbol: 'USDC', payableSymbols }).map(
        (item) => item.token.symbol,
      ),
    ).toEqual(['USDC', 'USDe', 'USDS', 'ETH', 'USDT']);
    // What decides is the list, not the kind of token
    expect(
      listPayTokens({
        group,
        depositSymbol: 'USDC',
        payableSymbols: new Set([...payableSymbols, 'susde']),
      }).map((item) => item.token.symbol),
    ).toContain('sUSDe');
    // Without the list, every token with a balance stays
    expect(listPayTokens({ group, depositSymbol: 'USDC' })).toHaveLength(13);
  });

  it('keeps the deposit token even when Earn does not list it', () => {
    expect(
      listPayTokens({
        group: ethereumWallet,
        depositSymbol: 'USDC',
        payableSymbols: new Set(),
      }).map((item) => item.token.symbol),
    ).toEqual(['USDC', 'ETH']);
  });

  it("is empty without the network's tokens", () => {
    expect(listPayTokens({ group: undefined, depositSymbol: 'USDC' })).toEqual(
      [],
    );
  });
});

describe('pickDefaultPayToken', () => {
  it('starts on the deposit token when the wallet holds it', () => {
    // USDT is the least valuable of the wallet's tokens
    const tokens = listPayTokens({
      group: ethereumWallet,
      depositSymbol: 'USDT',
    });
    expect(pickDefaultPayToken(tokens)?.token.symbol).toBe('USDT');
    expect(pickDefaultPayToken(tokens.toReversed())?.token.symbol).toBe('USDT');
  });

  it('else starts on the most valuable token', () => {
    expect(
      pickDefaultPayToken(
        listPayTokens({ group: ethereumWallet, depositSymbol: 'DAI' }),
      )?.token.symbol,
    ).toBe('USDC');
  });

  it('has nothing to start on without tokens', () => {
    expect(pickDefaultPayToken([])).toBeUndefined();
  });
});

describe('picks in Pay with picker', () => {
  const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
  const CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52';
  const held = listPayTokens({ group: ethereumWallet, depositSymbol: 'USDC' });
  const heldUsdt = held.find((item) => item.token.symbol === 'USDT');
  const swapToken = (
    symbol: string,
    contractAddress: string,
    extra: Partial<ISwapToken> = {},
  ): ISwapToken => ({
    networkId: 'evm--1',
    contractAddress,
    symbol,
    name: symbol,
    decimals: 8,
    ...extra,
  });
  const pick = (token: ISwapToken) =>
    toPickedPayToken({ token, tokens: [], depositSymbol: 'USDC' });

  describe('toPickedPayToken', () => {
    it("uses the wallet's entry for a token Pay with lists, the address in any case", () => {
      const picked = toPickedPayToken({
        token: swapToken('USDT', USDT.toLowerCase(), { balanceParsed: '9' }),
        tokens: held,
        depositSymbol: 'USDC',
      });
      expect(picked).toBe(heldUsdt);
    });

    it('matches the network coin by its being native', () => {
      const picked = toPickedPayToken({
        token: swapToken('ETH', '', { isNative: true, decimals: 18 }),
        tokens: held,
        depositSymbol: 'USDC',
      });
      expect(picked.key).toBe('eth');
    });

    it('builds a token the list lacks from the picker, with its balance and USD value', () => {
      const picked = toPickedPayToken({
        token: swapToken('CRV', CRV, {
          balanceParsed: '0.4851',
          fiatValue: '0.17',
          price: '0.35',
          currency: 'usd',
          decimals: 18,
          logoURI: 'crv.png',
        }),
        tokens: held,
        depositSymbol: 'USDC',
      });
      const key = `earn-pay-picked|evm--1|${CRV.toLowerCase()}`;
      expect(picked).toEqual({
        key,
        token: {
          $key: key,
          address: CRV,
          decimals: 18,
          logoURI: 'crv.png',
          name: 'CRV',
          symbol: 'CRV',
          networkId: 'evm--1',
        },
        networkId: 'evm--1',
        amount: '0.4851',
        fiatValueUsd: '0.17',
        priceUsd: '0.35',
        isDepositToken: false,
      });
    });

    it('gives a token the wallet holds none of no balance, and no value or price in another currency', () => {
      const picked = pick(
        swapToken('WBTC', WBTC, {
          price: '600000',
          fiatValue: '0',
          currency: 'cny',
        }),
      );
      expect(picked.amount).toBe('0');
      expect(picked.fiatValueUsd).toBe('0');
      expect(picked.priceUsd).toBe('0');
    });

    it('knows the deposit token by its address, or by its symbol without one', () => {
      const usdc = swapToken('USDC', USDC);
      expect(
        toPickedPayToken({
          token: usdc,
          tokens: [],
          depositToken: { address: USDC.toLowerCase(), isNative: false },
          depositSymbol: 'USDC',
        }).isDepositToken,
      ).toBe(true);
      // Another token that only shares the symbol
      expect(
        toPickedPayToken({
          token: swapToken('USDC', WBTC),
          tokens: [],
          depositToken: { address: USDC },
          depositSymbol: 'USDC',
        }).isDepositToken,
      ).toBe(false);
      expect(
        toPickedPayToken({ token: usdc, tokens: [], depositSymbol: 'usdc' })
          .isDepositToken,
      ).toBe(true);
    });
  });

  describe('mergePickedPayTokens', () => {
    const wbtc = pick(swapToken('WBTC', WBTC));

    it("adds the picks the list lacks after the wallet's tokens", () => {
      expect(mergePickedPayTokens(held, [wbtc])).toEqual([...held, wbtc]);
    });

    it('drops a pick of a token the wallet has come to hold', () => {
      expect(mergePickedPayTokens(held, [pick(swapToken('USDT', USDT))])).toBe(
        held,
      );
    });

    it('is the list itself without picks', () => {
      expect(mergePickedPayTokens(held, [])).toBe(held);
    });
  });

  describe('findPayToken', () => {
    it('finds a token by its key', () => {
      expect(findPayToken(held, heldUsdt?.key)).toBe(heldUsdt);
    });

    it("finds the wallet's entry for a pick the wallet has come to hold", () => {
      expect(findPayToken(held, pick(swapToken('USDT', USDT)).key)).toBe(
        heldUsdt,
      );
      expect(
        findPayToken(held, pick(swapToken('ETH', '', { isNative: true })).key)
          ?.key,
      ).toBe('eth');
    });

    it('finds nothing without a key, for an unknown one, or for a pick no longer listed', () => {
      expect(findPayToken(held, undefined)).toBeUndefined();
      expect(findPayToken(held, 'unknown')).toBeUndefined();
      expect(findPayToken(held, pick(swapToken('WBTC', WBTC)).key)).toBe(
        undefined,
      );
    });
  });

  describe('withPickedTokenDetails', () => {
    const wbtc = pick(swapToken('WBTC', WBTC));

    it('takes the balance, value and price read in USD', () => {
      expect(
        withPickedTokenDetails(
          wbtc,
          swapToken('WBTC', WBTC, {
            balanceParsed: '0.01',
            fiatValue: '801.2',
            price: '80120',
            currency: 'usd',
          }),
        ),
      ).toMatchObject({
        key: wbtc.key,
        amount: '0.01',
        fiatValueUsd: '801.2',
        priceUsd: '80120',
      });
    });

    it('takes the balance but keeps the value and price from details in another currency', () => {
      expect(
        withPickedTokenDetails(
          { ...wbtc, fiatValueUsd: '5', priceUsd: '500' },
          swapToken('WBTC', WBTC, {
            balanceParsed: '0.01',
            fiatValue: '3600',
            price: '360000',
            currency: 'cny',
          }),
        ),
      ).toMatchObject({ amount: '0.01', fiatValueUsd: '5', priceUsd: '500' });
    });

    it('keeps the balance when the details carry none', () => {
      expect(
        withPickedTokenDetails(
          { ...wbtc, amount: '2' },
          swapToken('WBTC', WBTC, { price: '80120', currency: 'usd' }),
        ).amount,
      ).toBe('2');
    });
  });
});

describe("Pay with's own tokens in the picker's list", () => {
  const SUSDE = '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497';
  const SUSD3 = '0xf689555121e529Ff0463e191F9Bd9d1E496164a7';
  const SPUSDC = '0x28B3a8fb53B741A8Fd78c0fb9A6B2393d896a43d';
  const STETH = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
  const CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52';
  const LINK = '0x514910771AF9Ca656af840dff83E8264EcF986CA';
  const token = (
    symbol: string,
    contractAddress: string,
    balanceParsed: string,
    fiatValue: string,
    extra: Partial<ISwapToken> = {},
  ): ISwapToken => ({
    networkId: 'evm--1',
    contractAddress,
    symbol,
    name: symbol,
    decimals: 18,
    balanceParsed,
    fiatValue,
    ...extra,
  });
  // The 10-26 test wallet on Ethereum, as Swap lists it with DeFi tokens off
  const list = [
    token('USDC', USDC.toLowerCase(), '4.0258', '4.02'),
    token('USDe', USDE.toLowerCase(), '2.2739', '2.27'),
    token('USDS', SKY_DOLLAR.toLowerCase(), '1.7666', '1.77'),
    token('ETH', '', '0.000723', '1.67', { isNative: true }),
    token('USDT', USDT.toLowerCase(), '0.8337', '0.83'),
    token('stETH', STETH.toLowerCase(), '0.000266', '0.61'),
    token('CRV', CRV.toLowerCase(), '0.4851', '0.16'),
    token('LINK', LINK.toLowerCase(), '0', '0'),
  ];
  // Its tokens Swap files under DeFi tokens
  const candidates = [
    token('spUSDC', SPUSDC.toLowerCase(), '19.48', '20.24'),
    token('sUSD3', SUSD3.toLowerCase(), '2.328', '2.97'),
    token('sUSDe', SUSDE.toLowerCase(), '2.275', '2.84'),
    token('stETH', STETH.toLowerCase(), '0.000266', '0.61'),
  ];
  // Pay with's own tokens there: the wallet's tokens Earn lists, and ETH
  const payTokenAddresses = [
    USDC,
    SUSD3,
    SUSDE,
    USDE,
    SKY_DOLLAR,
    '',
    USDT,
    STETH,
  ].map((address) => address.toLowerCase());
  const symbols = (tokens: ISwapToken[]) => tokens.map((item) => item.symbol);

  it("adds Pay with's tokens that Swap files under DeFi tokens, among the wallet's by value", () => {
    expect(
      symbols(listWithPayTokens({ list, candidates, payTokenAddresses })),
    ).toEqual([
      'USDC',
      'sUSD3',
      'sUSDe',
      'USDe',
      'USDS',
      'ETH',
      'USDT',
      'stETH',
      'CRV',
      'LINK',
    ]);
  });

  it("leaves out other DeFi tokens, a token listed already and one the wallet doesn't hold", () => {
    const result = listWithPayTokens({
      list,
      candidates: [
        candidates[0],
        candidates[3],
        token('sUSDe', SUSDE.toLowerCase(), '0', '0'),
      ],
      payTokenAddresses,
    });
    expect(result).toBe(list);
  });

  it('puts a token worth less than every held one after them, before the tokens not held', () => {
    expect(
      symbols(
        listWithPayTokens({
          list,
          candidates: [token('sUSDe', SUSDE.toLowerCase(), '0.01', '0.01')],
          payTokenAddresses,
        }),
      ).slice(-3),
    ).toEqual(['CRV', 'sUSDe', 'LINK']);
  });

  it('matches the address in any case', () => {
    expect(
      symbols(
        listWithPayTokens({
          list,
          candidates: [token('sUSDe', SUSDE, '2.275', '2.84')],
          payTokenAddresses,
        }),
      ).slice(0, 3),
    ).toEqual(['USDC', 'sUSDe', 'USDe']);
  });

  it('takes the address as Pay with keys its tokens', () => {
    const [usdc] = listPayTokens({
      group: ethereumWallet,
      depositSymbol: 'USDC',
    });
    expect(getPayTokenAddress(usdc)).toBe(USDC.toLowerCase());
  });

  describe('matchesPayTokenKeyword', () => {
    const susde = candidates[2];
    it('matches the typed letters in the symbol or the name, in any case', () => {
      expect(matchesPayTokenKeyword(susde, 'SUSD')).toBe(true);
      expect(
        matchesPayTokenKeyword({ ...susde, name: 'Staked USDe' }, ' staked '),
      ).toBe(true);
      expect(matchesPayTokenKeyword(susde, 'usd3')).toBe(false);
    });

    it('matches a whole contract address only', () => {
      expect(matchesPayTokenKeyword(susde, SUSDE)).toBe(true);
      expect(matchesPayTokenKeyword(susde, SUSDE.slice(0, 10))).toBe(false);
    });

    it('matches anything without a keyword', () => {
      expect(matchesPayTokenKeyword(susde, '  ')).toBe(true);
    });
  });
});

describe('resolvePayMode', () => {
  const payToken = (
    token: IAccountToken,
    isDepositToken = false,
  ): IEarnRouterPayToken => ({
    key: token.$key,
    token,
    networkId: 'evm--1',
    amount: '1',
    fiatValueUsd: '1',
    priceUsd: '1',
    isDepositToken,
  });
  const usde = payToken(walletToken('USDe', USDE), true);
  const usdc = payToken(walletToken('USDC', USDC));
  const usdt = payToken(walletToken('USDT', USDT));
  const ether = payToken(eth);
  // What a Pendle USDe market takes in, addresses as its list sends them
  const pendleInputs = [
    { address: USDE.toLowerCase(), isNative: false },
    { address: USDC.toLowerCase(), isNative: false },
    { isNative: true },
  ];

  it('deposits directly without a pay token or with the deposit token', () => {
    expect(
      resolvePayMode({ takesOtherTokens: true, zapInputs: pendleInputs }),
    ).toBe('direct');
    [true, false].forEach((takesOtherTokens) => {
      expect(
        resolvePayMode({
          payToken: usde,
          takesOtherTokens,
          zapInputs: pendleInputs,
        }),
      ).toBe('direct');
    });
  });

  it('zaps a token the provider takes in, whatever the address case', () => {
    expect(
      resolvePayMode({
        payToken: usdc,
        takesOtherTokens: true,
        zapInputs: pendleInputs,
      }),
    ).toBe('zap');
    // Native staking on ETH takes WETH as well
    expect(
      resolvePayMode({
        payToken: payToken(walletToken('WETH', WETH, { decimals: 18 })),
        takesOtherTokens: true,
        zapInputs: [{ isNative: true }, { address: WETH.toLowerCase() }],
      }),
    ).toBe('zap');
  });

  it('matches a native token to a native input only', () => {
    expect(
      resolvePayMode({
        payToken: ether,
        takesOtherTokens: true,
        zapInputs: pendleInputs,
      }),
    ).toBe('zap');
    expect(
      resolvePayMode({
        payToken: ether,
        takesOtherTokens: true,
        zapInputs: [{ address: WETH.toLowerCase(), isNative: false }],
      }),
    ).toBe('swapThenDeposit');
  });

  it('swaps first when the provider does not take the token', () => {
    expect(
      resolvePayMode({
        payToken: usdt,
        takesOtherTokens: true,
        zapInputs: pendleInputs,
      }),
    ).toBe('swapThenDeposit');
    // Before the provider's list loads
    expect(resolvePayMode({ payToken: usdc, takesOtherTokens: true })).toBe(
      'swapThenDeposit',
    );
  });

  it('swaps first into a provider that takes only its own token', () => {
    expect(
      resolvePayMode({
        payToken: usdc,
        takesOtherTokens: false,
        zapInputs: pendleInputs,
      }),
    ).toBe('swapThenDeposit');
  });
});

const protocolOffer = (
  name: string,
  apr: number,
  vault?: string,
  networkId = 'evm--1',
): IEarnDesktopHoldOffer => ({
  kind: 'protocol',
  key: `${networkId}-${name}-${vault ?? ''}`,
  apr,
  isFixedRate: false,
  item: {
    provider: { name, vault, aprWithoutFee: String(apr) },
    network: { networkId, name: networkId, logoURI: '' },
  } as unknown as IStakeProtocolListItem,
});

const lendingOffer = (
  provider: string,
  apr: number,
  marketAddress: string,
  networkId = 'evm--1',
): IEarnDesktopHoldOffer => {
  const key = `${provider}:${networkId}:${marketAddress}:${USDC}`;
  return {
    kind: 'lending',
    key,
    apr,
    isFixedRate: false,
    offer: {
      key,
      market: {
        provider,
        networkId,
        marketAddress,
        name: '',
        logoURI: '',
      } as unknown as IBorrowMarketItem,
      marketLabel: '',
      reserveAddress: USDC,
      symbol: 'USDC',
      logoURI: '',
      apy: String(apr),
    },
  };
};

// The 10-21 test wallet's USDC offers, best rate first. On Ethereum: Spark,
// Aave Core and a Morpho vault; on Base: two Morpho vaults 0.0001 apart
const sparkUsdc = protocolOffer('spark', 5.42, 'spark-savings-usdc');
const aaveCoreUsdc = lendingOffer('aave', 3.86, 'aave-core');
const morphoUsdc = protocolOffer('morpho', 3.83, 'hakutora-usdc');
const ethereumUsdc = [sparkUsdc, aaveCoreUsdc, morphoUsdc];
const gauntletPrime = protocolOffer(
  'morpho',
  4.215,
  'gauntlet-usdc-prime',
  'evm--8453',
);
const pangolins = protocolOffer(
  'morpho',
  4.2149,
  'pangolins-usdc',
  'evm--8453',
);
const baseUsdc = [gauntletPrime, pangolins];

// ETH on Ethereum, where a Morpho vault pays the most
const morphoEth = protocolOffer('morpho', 3.9, 'gauntlet-weth-prime');
const lidoEth = protocolOffer('lido', 2.6);
const ethereumEth = [
  morphoEth,
  protocolOffer('pendle', 3.5, 'pt-steth-market'),
  protocolOffer('native', 3.4, 'native-eth'),
  protocolOffer('everstake', 3.1),
  protocolOffer('stakefish', 2.95),
  lidoEth,
];

describe('findOffer', () => {
  it('finds a protocol offer by provider name in any case', () => {
    expect(findOffer({ offers: ethereumUsdc, provider: 'Morpho' })).toBe(
      morphoUsdc,
    );
  });

  it('narrows a provider to its vault when both sides have one', () => {
    expect(findOffer({ offers: baseUsdc, provider: 'morpho' })).toBe(
      gauntletPrime,
    );
    expect(
      findOffer({
        offers: baseUsdc,
        provider: 'morpho',
        vault: 'Pangolins-USDC',
      }),
    ).toBe(pangolins);
    expect(
      findOffer({
        offers: baseUsdc,
        provider: 'morpho',
        vault: 'steakhouse-usdc',
      }),
    ).toBeUndefined();
  });

  it('matches an offer without a vault to any vault', () => {
    expect(
      findOffer({ offers: ethereumEth, provider: 'lido', vault: 'steth' }),
    ).toBe(lidoEth);
  });

  it('finds a lending offer by market provider, narrowed by its market', () => {
    const aavePrimeUsdc = lendingOffer('aave', 3.5, 'aave-prime');
    const offers = [...ethereumUsdc, aavePrimeUsdc];
    expect(findOffer({ offers, provider: 'Aave' })).toBe(aaveCoreUsdc);
    expect(
      findOffer({ offers, provider: 'aave', marketAddress: 'AAVE-PRIME' }),
    ).toBe(aavePrimeUsdc);
    expect(
      findOffer({ offers, provider: 'aave', marketAddress: 'aave-etherfi' }),
    ).toBeUndefined();
    // A vault doesn't narrow a lending market
    expect(
      findOffer({ offers, provider: 'aave', vault: 'hakutora-usdc' }),
    ).toBe(aaveCoreUsdc);
  });

  it('finds nothing for a provider without an offer', () => {
    expect(
      findOffer({ offers: ethereumUsdc, provider: 'ethena' }),
    ).toBeUndefined();
    expect(findOffer({ offers: [], provider: 'spark' })).toBeUndefined();
  });
});

describe('pickBetterOffer', () => {
  it('points a withdrawal from Morpho or Aave on Ethereum to Spark', () => {
    expect(
      pickBetterOffer({
        offers: ethereumUsdc,
        provider: 'morpho',
        vault: 'hakutora-usdc',
      }),
    ).toEqual({ from: morphoUsdc, better: sparkUsdc });
    expect(pickBetterOffer({ offers: ethereumUsdc, provider: 'aave' })).toEqual(
      { from: aaveCoreUsdc, better: sparkUsdc },
    );
  });

  it('has nothing better for the best rate', () => {
    expect(
      pickBetterOffer({
        offers: ethereumUsdc,
        provider: 'spark',
        vault: 'spark-savings-usdc',
      }),
    ).toEqual({ from: sparkUsdc, better: undefined });
  });

  it('leaves a gain under 0.5 points alone', () => {
    expect(
      pickBetterOffer({
        offers: baseUsdc,
        provider: 'morpho',
        vault: 'pangolins-usdc',
      }),
    ).toEqual({ from: pangolins, better: undefined });
  });

  it('counts a gain of exactly 0.5 points', () => {
    // 4.35 - 3.85 is 0.49999999999999956 in floating point
    const spark = protocolOffer('spark', 4.35, 'spark-savings-usdc');
    const morpho = protocolOffer('morpho', 3.85, 'hakutora-usdc');
    expect(
      pickBetterOffer({ offers: [spark, morpho], provider: 'morpho' }).better,
    ).toBe(spark);
  });

  // Pendle sells into a token picked in its form, and staking queues its
  // withdrawals: neither leaves the token in the wallet to deposit again.
  // Each provider has an offer in the list, so only the rule returns {};
  // Babylon stakes BTC and joins the ETH list for that alone
  it.each([
    'pendle',
    'Pendle',
    'native',
    'lido',
    'everstake',
    'stakefish',
    'babylon',
  ])('suggests nothing after a %s withdrawal', (provider) => {
    expect(
      pickBetterOffer({
        offers: [...ethereumEth, protocolOffer('babylon', 1.2)],
        provider,
      }),
    ).toEqual({});
  });

  it('compares any other ETH offer as usual', () => {
    expect(
      pickBetterOffer({ offers: ethereumEth, provider: 'morpho' }),
    ).toEqual({ from: morphoEth, better: undefined });
  });

  it('has nothing to compare without the offer', () => {
    expect(
      pickBetterOffer({ offers: ethereumUsdc, provider: 'ethena' }),
    ).toEqual({});
  });
});

describe('earnRouterSwapReducer', () => {
  const STATES = {
    idle: EARN_ROUTER_SWAP_IDLE,
    preparing: { status: 'preparing' },
    confirming: { status: 'confirming' },
    swapping: { status: 'swapping' },
    swapped: { status: 'swapped', amount: '2.44', balance: '7.44' },
  } satisfies Record<string, IEarnRouterSwapState>;
  const LANDED: IEarnRouterSwapAction = {
    type: 'landed',
    amount: '2.44',
    balance: '7.44',
  };
  const play = (
    state: IEarnRouterSwapState,
    ...actions: IEarnRouterSwapAction[]
  ) =>
    actions.reduce(
      (current, action) => earnRouterSwapReducer(current, action),
      state,
    );

  it('runs the swap to the end on one press', () => {
    expect(
      play(
        STATES.idle,
        { type: 'prepare' },
        { type: 'confirm' },
        { type: 'sent' },
        LANDED,
      ),
    ).toEqual(STATES.swapped);
  });

  it('goes back to the start when the wallet rejects or a check stops it', () => {
    expect(earnRouterSwapReducer(STATES.preparing, { type: 'stop' })).toBe(
      EARN_ROUTER_SWAP_IDLE,
    );
    expect(earnRouterSwapReducer(STATES.confirming, { type: 'stop' })).toBe(
      EARN_ROUTER_SWAP_IDLE,
    );
  });

  it('goes back to the start when a sent swap fails', () => {
    expect(earnRouterSwapReducer(STATES.swapping, { type: 'stop' })).toBe(
      EARN_ROUTER_SWAP_IDLE,
    );
  });

  it('keeps a landed swap: the deposit form has taken over', () => {
    expect(earnRouterSwapReducer(STATES.swapped, { type: 'stop' })).toBe(
      STATES.swapped,
    );
    expect(earnRouterSwapReducer(STATES.swapped, { type: 'prepare' })).toBe(
      STATES.swapped,
    );
  });

  it('takes each step only from the one before', () => {
    expect(earnRouterSwapReducer(STATES.idle, { type: 'confirm' })).toBe(
      STATES.idle,
    );
    expect(earnRouterSwapReducer(STATES.preparing, { type: 'sent' })).toBe(
      STATES.preparing,
    );
    expect(earnRouterSwapReducer(STATES.confirming, LANDED)).toBe(
      STATES.confirming,
    );
    expect(earnRouterSwapReducer(STATES.swapping, { type: 'prepare' })).toBe(
      STATES.swapping,
    );
  });
});

describe('getEarnSwapDepositAmount', () => {
  it('deposits what the swap delivered, rounded down to what the provider takes', () => {
    expect(
      getEarnSwapDepositAmount({
        receivedAmount: '2.4414567',
        balanceAfter: '10',
        decimals: 6,
      }),
    ).toBe('2.441456');
  });

  it('never deposits more than the balance holds', () => {
    expect(
      getEarnSwapDepositAmount({
        receivedAmount: '2.5',
        balanceAfter: '2.4',
        decimals: 6,
      }),
    ).toBe('2.4');
  });

  it('falls back to what the balance gained, then to the quoted minimum', () => {
    expect(
      getEarnSwapDepositAmount({
        balanceBefore: '1',
        balanceAfter: '3.44',
        decimals: 6,
      }),
    ).toBe('2.44');
    expect(getEarnSwapDepositAmount({ minToAmount: '2.4', decimals: 6 })).toBe(
      '2.4',
    );
  });

  it('gives nothing when nothing came in', () => {
    expect(
      getEarnSwapDepositAmount({
        balanceBefore: '3',
        balanceAfter: '3',
        decimals: 6,
      }),
    ).toBe('');
  });
});

describe('getEarnSwapPayMax', () => {
  it('pays all of a token', () => {
    expect(
      getEarnSwapPayMax({ balance: '12.5', reserveGas: 0.001, decimals: 6 }),
    ).toBe('12.5');
  });

  it("keeps the network coin's fees for the swap and the deposit", () => {
    expect(
      getEarnSwapPayMax({
        balance: '0.01',
        isNative: true,
        reserveGas: 0.001,
        decimals: 18,
      }),
    ).toBe('0.008');
  });

  it('pays none of the coin when the fees take it all', () => {
    expect(
      getEarnSwapPayMax({
        balance: '0.001',
        isNative: true,
        reserveGas: 0.001,
        decimals: 18,
      }),
    ).toBe('0');
  });
});

describe('isUsableEarnSwapQuote', () => {
  const ETH_TOKEN = {
    networkId: 'evm--8453',
    contractAddress: '',
    isNative: true,
    symbol: 'ETH',
    decimals: 18,
  };
  const USDC_TOKEN = {
    networkId: 'evm--8453',
    contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    symbol: 'USDC',
    decimals: 6,
  };
  const quote = (extra: Partial<IFetchQuoteResult> = {}) =>
    ({
      info: { provider: 'swap_0x', providerName: '0x' },
      fromTokenInfo: {
        ...ETH_TOKEN,
        contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      },
      toTokenInfo: {
        ...USDC_TOKEN,
        contractAddress: USDC_TOKEN.contractAddress.toUpperCase(),
      },
      fromAmount: '0.0010',
      toAmount: '2.44',
      ...extra,
    }) as IFetchQuoteResult;
  const check = (extra?: Partial<IFetchQuoteResult>) =>
    isUsableEarnSwapQuote({
      quote: quote(extra),
      fromToken: ETH_TOKEN,
      toToken: USDC_TOKEN,
      amount: '0.001',
    });

  it('takes an on-chain swap of the pair and amount', () => {
    expect(check()).toBe(true);
  });

  it('leaves out signed orders, wraps and errors', () => {
    expect(
      check({
        swapShouldSignedData: {} as IFetchQuoteResult['swapShouldSignedData'],
      }),
    ).toBe(false);
    expect(check({ isWrapped: true })).toBe(false);
    expect(check({ errorMessage: 'No liquidity' })).toBe(false);
    expect(check({ toAmount: '0' })).toBe(false);
  });

  it('leaves out a quote for another token or amount', () => {
    expect(check({ fromAmount: '0.002' })).toBe(false);
    expect(
      check({
        toTokenInfo: { ...USDC_TOKEN, contractAddress: '0xdead' },
      }),
    ).toBe(false);
  });
});

describe('getEarnSwapSlippage', () => {
  it("takes the provider's suggestion, else the Swap page's automatic value", () => {
    expect(
      getEarnSwapSlippage({ autoSuggestedSlippage: 0.5 } as IFetchQuoteResult),
    ).toBe(0.5);
    expect(getEarnSwapSlippage({} as IFetchQuoteResult)).toBe(1);
  });
});

describe('keepPendleMarketRows', () => {
  // Pendle's quote for 1.1993 sUSDe into PT-sUSDE (26 Nov 2026), 10-26
  const quote = {
    rewards: [
      {
        title: { text: 'Effective Fixed APY' },
        description: { text: '4.67%' },
      },
      { title: { text: 'Maturity' }, description: { text: '26 Nov 2026' } },
      {
        title: { text: 'At Maturity You Get' },
        description: {
          text: '1.510816864369869454 USDe (in sUSDe)\n-0.05% Gain',
        },
      },
    ],
    receive: {
      title: { text: 'Est. receive' },
      description: { text: '1.510816864369869454' },
    },
    transactionDetails: {
      type: 'view',
      data: {
        transactionDetails: [
          {
            title: { text: 'Market Reference APY' },
            current: { title: { text: '4.77%', color: '$textSubdued' } },
            latest: { title: { text: '4.77%' } },
          },
          {
            title: { text: 'Min. Received' },
            description: { text: '1.4957 PT sUSDe' },
          },
          {
            title: { text: 'Fee' },
            description: { text: '<0.01%' },
            button: { type: 'popup', data: { title: { text: 'Fee details' } } },
          },
        ],
        swapRoute: [
          {
            token: {
              decimals: 18,
              address: '0x9d39a5de30e57443bff2a8307a4256c8797a3497',
              symbol: 'sUSDe',
              logoURI: 'https://example.com/susde.png',
            },
            connector: { text: { text: 'Pendle -0.01%' } },
          },
          {
            token: {
              decimals: 18,
              address: '0xb195b618ea52b77cb2a58846f452f59f8dfa9390',
              symbol: 'PT-sUSDE',
              logoURI: 'https://example.com/pt-susde.png',
            },
          },
        ],
      },
    },
  } as IStakeTransactionConfirmation;

  it("keeps the market's rate before and after, not the buy's own rows", () => {
    const kept = keepPendleMarketRows(quote);
    expect(
      kept?.transactionDetails?.data?.transactionDetails?.map(
        (row) => row.title.text,
      ),
    ).toEqual(['Market Reference APY']);
    expect(kept?.transactionDetails?.data?.swapRoute).toBeUndefined();
  });

  it('keeps the rest of the quote, and the quote itself, as they are', () => {
    const kept = keepPendleMarketRows(quote);
    expect(kept?.rewards).toBe(quote.rewards);
    expect(kept?.receive).toBe(quote.receive);
    expect(kept?.transactionDetails?.type).toBe('view');
    expect(quote.transactionDetails?.data?.transactionDetails).toHaveLength(3);
    expect(quote.transactionDetails?.data?.swapRoute).toHaveLength(2);
  });

  it('returns a quote without details, or none, as it is', () => {
    expect(keepPendleMarketRows(undefined)).toBeUndefined();
    const plain: IStakeTransactionConfirmation = { rewards: [] };
    expect(keepPendleMarketRows(plain)).toBe(plain);
  });
});

describe('Pay with across networks (11-05)', () => {
  const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
  const ethereum = {
    ...ethereumWallet,
    networkId: 'evm--1',
    accountId: 'hd-1--evm',
  };
  const arbitrum = {
    networkId: 'evm--42161',
    accountId: 'hd-1--evm',
    tokens: [walletToken('USDC', ARB_USDC), { ...eth, $key: 'arb-eth' }],
    map: {
      [ARB_USDC]: walletFiat('12.5', '12.49'),
      'arb-eth': walletFiat('0.01', '24.34', { price: 2434.3 }),
    },
  };

  it('lists the deposit token on its network first, the same token elsewhere next', () => {
    const tokens = listPayTokensAcrossNetworks({
      groups: [arbitrum, ethereum],
      depositSymbol: 'USDC',
      depositNetworkId: 'evm--1',
    });
    expect(
      tokens
        .slice(0, 3)
        .map((item) => [
          item.token.symbol,
          item.networkId,
          item.isDepositToken,
        ]),
    ).toEqual([
      ['USDC', 'evm--1', true],
      ['USDC', 'evm--42161', false],
      ['ETH', 'evm--42161', false],
    ]);
    expect(tokens.every((item) => item.accountId === 'hd-1--evm')).toBe(true);
  });

  it('starts on the largest holding of the token on any network', () => {
    const tokens = listPayTokensAcrossNetworks({
      groups: [arbitrum, ethereum],
      depositSymbol: 'USDC',
      depositNetworkId: 'evm--1',
    });
    const start = pickDefaultPayTokenAcrossNetworks(tokens, 'USDC');
    expect([start?.token.symbol, start?.networkId]).toEqual([
      'USDC',
      'evm--42161',
    ]);
  });

  it('starts on the largest holding of anything without the token', () => {
    const tokens = listPayTokensAcrossNetworks({
      groups: [arbitrum, ethereum],
      depositSymbol: 'WBTC',
      depositNetworkId: 'evm--1',
    });
    const start = pickDefaultPayTokenAcrossNetworks(tokens, 'WBTC');
    expect([start?.token.symbol, start?.networkId]).toEqual([
      'ETH',
      'evm--42161',
    ]);
  });

  it('bridges a token on another network, the deposit token too', () => {
    const tokens = listPayTokensAcrossNetworks({
      groups: [arbitrum, ethereum],
      depositSymbol: 'USDC',
      depositNetworkId: 'evm--1',
    });
    const arbUsdc = tokens.find(
      (item) => item.token.symbol === 'USDC' && item.networkId === 'evm--42161',
    );
    const ethUsdc = tokens.find(
      (item) => item.token.symbol === 'USDC' && item.networkId === 'evm--1',
    );
    expect(
      resolvePayMode({
        payToken: arbUsdc,
        takesOtherTokens: false,
        depositNetworkId: 'evm--1',
      }),
    ).toBe('bridgeThenDeposit');
    expect(
      resolvePayMode({
        payToken: ethUsdc,
        takesOtherTokens: false,
        depositNetworkId: 'evm--1',
      }),
    ).toBe('direct');
  });

  it('keeps a pick apart from the same address on another network', () => {
    const picked = toPickedPayToken({
      token: {
        networkId: 'evm--8453',
        contractAddress: USDC,
        symbol: 'USDC',
        decimals: 6,
        isNative: false,
      } as ISwapToken,
      tokens: listPayTokens({
        group: ethereum,
        depositSymbol: 'USDC',
        depositNetworkId: 'evm--1',
      }),
      depositSymbol: 'USDC',
      depositNetworkId: 'evm--1',
    });
    expect([picked.networkId, picked.isDepositToken]).toEqual([
      'evm--8453',
      false,
    ]);
    expect(picked.key.startsWith('earn-pay-picked|evm--8453|')).toBe(true);
    expect(
      mergePickedPayTokens(
        listPayTokens({ group: ethereum, depositSymbol: 'USDC' }),
        [picked],
      ).some((item) => item.key === picked.key),
    ).toBe(true);
  });
});

describe('bridge quotes (11-05)', () => {
  it('is a bridge when the tokens are on two networks', () => {
    expect(
      isEarnBridge({
        fromToken: { networkId: 'evm--42161' },
        toToken: { networkId: 'evm--8453' },
      }),
    ).toBe(true);
    expect(
      isEarnBridge({
        fromToken: { networkId: 'evm--8453' },
        toToken: { networkId: 'evm--8453' },
      }),
    ).toBe(false);
  });

  it('reads the arrival in minutes, the server value first', () => {
    const quote = (extra: Partial<IFetchQuoteResult>) =>
      ({ info: { provider: 'p' }, ...extra }) as IFetchQuoteResult;
    expect(getEarnSwapMinutes(quote({ estTime: 3, estimatedTime: 600 }))).toBe(
      3,
    );
    expect(getEarnSwapMinutes(quote({ estimatedTime: '90' }))).toBe(1.5);
    expect(getEarnSwapMinutes(quote({}))).toBeUndefined();
    expect(getEarnSwapMinutes(undefined)).toBeUndefined();
  });

  it('reads the fee in USD when quoted', () => {
    const quote = (fee?: number) =>
      ({
        info: { provider: 'p' },
        fee:
          fee === undefined
            ? undefined
            : { percentageFee: 0, estimatedFeeFiatValue: fee },
      }) as IFetchQuoteResult;
    expect(getEarnSwapFeeUsd(quote(0.42))).toBe(0.42);
    expect(getEarnSwapFeeUsd(quote(0))).toBeUndefined();
    expect(getEarnSwapFeeUsd(quote())).toBeUndefined();
  });
});
