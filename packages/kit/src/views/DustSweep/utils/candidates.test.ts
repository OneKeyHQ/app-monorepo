import {
  ETokenRiskLevel,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
} from '@onekeyhq/shared/types/token';

import {
  buildDustSweepCandidates,
  filterDustSweepCandidates,
  getDustSweepSlippageNotice,
  isValidDustSweepSlippage,
} from './candidates';

function response(
  entries: Array<Partial<IAccountToken> & { value: string; key: string }>,
): IFetchAccountTokensResp {
  const tokens = entries.map(({ value, key, ...entry }) => ({
    $key: key,
    address: key,
    symbol: key,
    name: key,
    decimals: 6,
    isNative: false,
    riskLevel: ETokenRiskLevel.BENIGN,
    ...entry,
  }));
  return {
    tokens: {
      data: tokens,
      keys: '',
      map: Object.fromEntries(
        entries.map(({ key, value }) => [
          key,
          {
            balance: '1234567',
            balanceParsed: '1.234567',
            fiatValue: value,
            price: 1,
            currency: 'usd',
          },
        ]),
      ),
    },
    smallBalanceTokens: { data: [], keys: '', map: {} },
    riskTokens: { data: [], keys: '', map: {} },
  };
}

function buildFixtureCandidates(
  data: IFetchAccountTokensResp,
  networkId: string,
) {
  const swapTokens: ISwapToken[] = [
    ...data.tokens.data,
    ...data.smallBalanceTokens.data,
    ...data.riskTokens.data,
  ].map((token) => ({
    networkId: token.networkId ?? networkId,
    contractAddress: token.address,
    symbol: token.symbol,
    decimals: token.decimals,
  }));
  return buildDustSweepCandidates(data, networkId, swapTokens);
}

describe('Dust Sweep candidate eligibility', () => {
  it('uses strict USD cutoffs and Ethereum-specific tiny balances, appending tiny rows once', () => {
    const tokens = buildFixtureCandidates(
      response([
        { key: 'a', value: '10' },
        { key: 'b', value: '0.1' },
        { key: 'c', value: '0.099' },
        { key: 'd', value: '9.99' },
      ]),
      'evm--1',
    );
    expect(
      filterDustSweepCandidates(tokens, 10, false).visible.map(
        (token) => token.key,
      ),
    ).toEqual(['d', 'b']);
    expect(
      filterDustSweepCandidates(tokens, 10, false).hidden.map(
        (token) => token.key,
      ),
    ).toEqual(['c']);
    expect(
      filterDustSweepCandidates(tokens, 10, true).visible.map(
        (token) => token.key,
      ),
    ).toEqual(['d', 'b', 'c']);
    expect(filterDustSweepCandidates(tokens, 10, true).hidden).toEqual([]);
    expect(
      filterDustSweepCandidates(
        tokens.map((token) => ({ ...token, networkId: 'evm--8453' })),
        1,
        false,
      ).visible,
    ).toHaveLength(2);
  });
  it('excludes native, positions, duplicate balance interfaces, spam, and wrong-network entries', () => {
    const data = response([
      { key: 'native', value: '1', isNative: true },
      { key: 'lp', value: '1', defiMarked: true },
      { key: 'position', value: '1', dappName: 'Protocol' },
      { key: 'shared', value: '1', sharedBalanceExcluded: true },
      { key: 'spam', value: '1', riskLevel: ETokenRiskLevel.SPAM },
      { key: 'wrong', value: '1', networkId: 'sol--101' },
      { key: 'valid', value: '1' },
    ]);
    data.smallBalanceTokens = data.tokens;
    data.riskTokens = response([
      { key: 'malicious', value: '1', riskLevel: ETokenRiskLevel.MALICIOUS },
      { key: 'scam', value: '1', riskLevel: ETokenRiskLevel.SCAM },
      { key: 'future-risk', value: '1', riskLevel: 1003 },
    ]).tokens;
    expect(
      buildFixtureCandidates(data, 'evm--1').map((token) => token.key),
    ).toEqual(['valid']);
  });
  it.each([
    ETokenRiskLevel.BENIGN,
    ETokenRiskLevel.WARNING,
    ETokenRiskLevel.UNKNOWN,
    undefined,
  ])('does not flag a priced token with risk level %s', (riskLevel) => {
    const [token] = buildFixtureCandidates(
      response([{ key: 'priced', value: '4', riskLevel }]),
      'evm--59144',
    );
    expect(token.suspicious).toBe(false);
  });

  it.each([0, undefined])(
    'keeps a token with price %s available for explicit selection without changing raw amounts',
    (price) => {
      const data = response([
        { key: 'scaled', value: '4', riskLevel: ETokenRiskLevel.UNKNOWN },
      ]);
      if (price === undefined) {
        Reflect.deleteProperty(data.tokens.map.scaled, 'price');
      } else {
        data.tokens.map.scaled.price = price;
      }
      const [token] = buildFixtureCandidates(data, 'sol--101');
      expect(token.suspicious).toBe(true);
      expect(token.amount).toBe('1.234567');
      expect(token.balanceMultiplier).toBeUndefined();
      expect(token.valueUsd).toBe('4');
    },
  );

  it('applies the hidden threshold to unverified tokens without changing their risk flag', () => {
    const data = response([
      { key: 'safe-hidden', value: '0.05' },
      {
        key: 'risk-hidden',
        value: '0.05',
        riskLevel: ETokenRiskLevel.UNKNOWN,
      },
    ]);
    data.tokens.map['risk-hidden'].price = 0;
    const tokens = buildFixtureCandidates(data, 'evm--1');
    const result = filterDustSweepCandidates(tokens, 10, false);

    expect(result.hidden.map((token) => token.key)).toEqual([
      'safe-hidden',
      'risk-hidden',
    ]);
    expect(result.visible).toEqual([]);
    const added = filterDustSweepCandidates(tokens, 10, true);
    expect(added.hidden).toEqual([]);
    expect(
      added.visible.find((token) => token.key === 'risk-hidden')?.suspicious,
    ).toBe(true);
  });
  it('does not expose scaled tokens that the existing Swap pipeline cannot execute', () => {
    expect(
      buildFixtureCandidates(
        response([{ key: 'scaled', value: '4', balanceMultiplier: '3' }]),
        'sol--101',
      ),
    ).toEqual([]);
  });
  it.each(['NaN', 'Infinity', '-1', '0'])(
    'rejects nonpositive or invalid USD value %s',
    (value) => {
      expect(
        buildFixtureCandidates(response([{ key: 'bad', value }]), 'evm--1'),
      ).toEqual([]);
    },
  );
  it.each([
    ['0', false],
    ['0.1', false],
    ['4.999', false],
    ['5', true],
    ['50', true],
    ['50.01', false],
    ['', false],
    ['Infinity', false],
    ['NaN', false],
  ])('validates slippage %s', (value, valid) => {
    expect(isValidDustSweepSlippage(value)).toBe(valid);
  });
});

describe('Dust Sweep candidates from Swap identities', () => {
  function swapToken(
    contractAddress: string,
    networkId = 'evm--1',
  ): ISwapToken {
    return {
      networkId,
      contractAddress,
      symbol: 'TOKEN',
      decimals: 6,
    };
  }

  it('includes a Swap token only after Wallet data supplies its balance and filters out Wallet-only tokens', () => {
    const swapTokens = [swapToken('0xswap')];
    const initial = response([{ key: 'wallet-only', value: '1' }]);

    expect(buildDustSweepCandidates(initial, 'evm--1', swapTokens)).toEqual([]);

    const hydrated = response([
      { key: 'wallet-only', value: '1' },
      { key: 'wallet-key', address: '0xSwap', value: '2' },
    ]);
    const candidates = buildDustSweepCandidates(hydrated, 'evm--1', swapTokens);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      contractAddress: '0xSwap',
      networkId: 'evm--1',
      amount: '1.234567',
      valueUsd: '2',
    });
  });

  it('continues applying Wallet risk and eligibility metadata to matching Swap assets', () => {
    const data = response([
      { key: 'scaled', value: '1', balanceMultiplier: '3' },
      { key: 'defi', value: '1', defiMarked: true },
      { key: 'dapp', value: '1', dappName: 'Position' },
      { key: 'shared', value: '1', sharedBalanceExcluded: true },
      { key: 'spam', value: '1', riskLevel: ETokenRiskLevel.SPAM },
      { key: 'native', value: '1', isNative: true },
      { key: 'valid', value: '1' },
    ]);
    const swapTokens = data.tokens.data.map((token) =>
      swapToken(token.address),
    );

    expect(
      buildDustSweepCandidates(data, 'evm--1', swapTokens).map(
        (token) => token.contractAddress,
      ),
    ).toEqual(['valid']);
  });

  it('does not discard a Swap risk or multiplier exclusion when Wallet data looks eligible', () => {
    const data = response([
      { key: 'swap-spam', value: '1' },
      { key: 'swap-scaled', value: '1' },
      { key: 'valid', value: '1' },
    ]);
    const swapTokens = [
      { ...swapToken('swap-spam'), riskLevel: ETokenRiskLevel.SPAM },
      { ...swapToken('swap-scaled'), balanceMultiplier: '2' },
      swapToken('valid'),
    ];

    expect(
      buildDustSweepCandidates(data, 'evm--1', swapTokens).map(
        (token) => token.contractAddress,
      ),
    ).toEqual(['valid']);
  });

  it('matches and deduplicates EVM addresses case-insensitively', () => {
    const data = response([
      { key: 'first', address: '0xABCD', value: '2' },
      { key: 'second', address: '0xabcd', value: '1' },
    ]);
    const result = buildDustSweepCandidates(data, 'evm--1', [
      swapToken('0xabcd'),
      swapToken('0xABCD'),
    ]);

    expect(result).toHaveLength(1);
  });

  it('keeps Solana token addresses case-sensitive and rejects other networks', () => {
    const data = response([
      { key: 'first', address: 'Abc', value: '2', networkId: 'sol--101' },
      { key: 'second', address: 'abc', value: '1', networkId: 'sol--101' },
      { key: 'wrong-network', address: 'def', value: '1', networkId: 'evm--1' },
    ]);
    const result = buildDustSweepCandidates(data, 'sol--101', [
      swapToken('Abc', 'sol--101'),
      swapToken('abc', 'sol--101'),
      swapToken('def', 'evm--1'),
    ]);

    expect(result.map((token) => token.contractAddress)).toEqual([
      'Abc',
      'abc',
    ]);
    expect(new Set(result.map((token) => token.key)).size).toBe(2);
  });
});

it.each([
  ['5', undefined],
  ['10', undefined],
  ['10.01', 'tooHigh'],
  ['20', 'tooHigh'],
  ['0.05', 'tooLow'],
  ['4.999', 'tooLow'],
  ['0', 'tooLow'],
  ['51', 'invalid'],
] as const)('gives slippage %s the %s notice', (value, notice) => {
  expect(getDustSweepSlippageNotice(value)).toBe(notice);
});
