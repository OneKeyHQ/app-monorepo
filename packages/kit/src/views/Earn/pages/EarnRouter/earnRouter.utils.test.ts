import type {
  IBorrowMarketItem,
  IStakeProtocolListItem,
} from '@onekeyhq/shared/types/staking';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  EARN_ROUTER_FLOW_IDLE,
  earnRouterFlowReducer,
  estimateDepositAmount,
  findOffer,
  listPayTokens,
  pickBetterOffer,
  pickDefaultPayToken,
  resolvePayMode,
} from './earnRouter.utils';

import type {
  IEarnRouterFlowAction,
  IEarnRouterFlowState,
  IEarnRouterFlowStep,
  IEarnRouterPayToken,
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

describe('resolvePayMode', () => {
  const payToken = (
    token: IAccountToken,
    isDepositToken = false,
  ): IEarnRouterPayToken => ({
    key: token.$key,
    token,
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

describe('estimateDepositAmount', () => {
  it('converts at the two prices', () => {
    // 0.000723 ETH at $2,440 into USDC at $1
    expect(
      estimateDepositAmount({
        payAmount: '0.000723',
        payPrice: '2440',
        depositPrice: '1',
      }),
    ).toBe('1.76412');
    // 0.8337 USDT at $0.9998 into USDe at $0.9995
    expect(
      Number(
        estimateDepositAmount({
          payAmount: '0.8337',
          payPrice: '0.9998',
          depositPrice: '0.9995',
        }),
      ),
    ).toBeCloseTo(0.833_95, 5);
  });

  it.each(['', '0', '-1', 'abc', '.'])(
    'is 0 for the amount %p',
    (payAmount) => {
      expect(
        estimateDepositAmount({ payAmount, payPrice: '1', depositPrice: '1' }),
      ).toBe('0');
    },
  );

  it.each(['0', '-1', '', 'NaN'])(
    'is 0 for the deposit price %p',
    (depositPrice) => {
      expect(
        estimateDepositAmount({
          payAmount: '1',
          payPrice: '2440',
          depositPrice,
        }),
      ).toBe('0');
    },
  );

  it('is 0 without a pay price', () => {
    expect(
      estimateDepositAmount({
        payAmount: '1',
        payPrice: '',
        depositPrice: '1',
      }),
    ).toBe('0');
    expect(
      estimateDepositAmount({
        payAmount: '1',
        payPrice: '0',
        depositPrice: '1',
      }),
    ).toBe('0');
  });
});

describe('earnRouterFlowReducer', () => {
  const running = (
    step: IEarnRouterFlowStep,
    phase: 'confirm' | 'pending',
  ): IEarnRouterFlowState => ({ status: 'running', step, phase });
  const STATES = {
    'idle': EARN_ROUTER_FLOW_IDLE,
    'swap confirm': running('swap', 'confirm'),
    'swap pending': running('swap', 'pending'),
    'deposit confirm': running('deposit', 'confirm'),
    'deposit pending': running('deposit', 'pending'),
    'swapped': { status: 'swapped' },
    'done': { status: 'done' },
  } satisfies Record<string, IEarnRouterFlowState>;
  const play = (
    state: IEarnRouterFlowState,
    ...types: IEarnRouterFlowAction['type'][]
  ) =>
    types.reduce(
      (current, type) => earnRouterFlowReducer(current, { type }),
      state,
    );

  it('starts with the swap', () => {
    expect(earnRouterFlowReducer(STATES.idle, { type: 'start' })).toEqual(
      running('swap', 'confirm'),
    );
  });

  it('waits on the chain once the wallet confirms', () => {
    expect(
      earnRouterFlowReducer(STATES['swap confirm'], { type: 'confirmed' }),
    ).toEqual(running('swap', 'pending'));
    expect(
      earnRouterFlowReducer(STATES['deposit confirm'], { type: 'confirmed' }),
    ).toEqual(running('deposit', 'pending'));
  });

  it('asks for the deposit as soon as the swap settles', () => {
    expect(
      earnRouterFlowReducer(STATES['swap pending'], { type: 'settled' }),
    ).toEqual(running('deposit', 'confirm'));
  });

  it('is done once the deposit settles', () => {
    expect(
      earnRouterFlowReducer(STATES['deposit pending'], { type: 'settled' }),
    ).toEqual({ status: 'done' });
  });

  it('runs both steps on one press', () => {
    expect(
      play(
        STATES.idle,
        'start',
        'confirmed',
        'settled',
        'confirmed',
        'settled',
      ),
    ).toEqual({ status: 'done' });
  });

  it('goes back to the start when the swap is cancelled', () => {
    expect(
      earnRouterFlowReducer(STATES['swap confirm'], { type: 'cancel' }),
    ).toEqual(EARN_ROUTER_FLOW_IDLE);
  });

  it('keeps the swapped tokens when the deposit is cancelled', () => {
    expect(
      earnRouterFlowReducer(STATES['deposit confirm'], { type: 'cancel' }),
    ).toEqual({ status: 'swapped' });
    expect(
      play(STATES.idle, 'start', 'confirmed', 'settled', 'cancel'),
    ).toEqual({ status: 'swapped' });
  });

  it('deposits only when started again after the swap', () => {
    expect(earnRouterFlowReducer(STATES.swapped, { type: 'start' })).toEqual(
      running('deposit', 'confirm'),
    );
    expect(play(STATES.swapped, 'start', 'confirmed', 'settled')).toEqual({
      status: 'done',
    });
  });

  it('cannot be cancelled once sent', () => {
    expect(
      earnRouterFlowReducer(STATES['swap pending'], { type: 'cancel' }),
    ).toBe(STATES['swap pending']);
    expect(
      earnRouterFlowReducer(STATES['deposit pending'], { type: 'cancel' }),
    ).toBe(STATES['deposit pending']);
  });

  it.each(Object.entries(STATES))('resets from %s', (_name, state) => {
    expect(earnRouterFlowReducer(state, { type: 'reset' })).toEqual(
      EARN_ROUTER_FLOW_IDLE,
    );
  });

  it.each([
    ['swap confirm', 'start'],
    ['swap pending', 'start'],
    ['deposit confirm', 'start'],
    ['deposit pending', 'start'],
    ['done', 'start'],
    ['idle', 'confirmed'],
    ['swap pending', 'confirmed'],
    ['deposit pending', 'confirmed'],
    ['swapped', 'confirmed'],
    ['done', 'confirmed'],
    ['idle', 'settled'],
    ['swap confirm', 'settled'],
    ['deposit confirm', 'settled'],
    ['swapped', 'settled'],
    ['done', 'settled'],
    ['idle', 'cancel'],
    ['swapped', 'cancel'],
    ['done', 'cancel'],
  ] as const)('leaves %s as it is on %s', (name, type) => {
    const state = STATES[name];
    expect(earnRouterFlowReducer(state, { type })).toBe(state);
  });
});
