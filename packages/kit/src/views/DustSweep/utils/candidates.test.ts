import { ETokenRiskLevel } from '@onekeyhq/shared/types/swap/types';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
} from '@onekeyhq/shared/types/token';

import {
  buildDustSweepCandidates,
  filterDustSweepCandidates,
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

describe('Dust Sweep candidate eligibility', () => {
  it('uses strict USD cutoffs and Ethereum-specific tiny balances, appending tiny rows once', () => {
    const tokens = buildDustSweepCandidates(
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
    expect(
      buildDustSweepCandidates(data, 'evm--1').map((token) => token.key),
    ).toEqual(['valid']);
  });
  it('keeps unverified tokens available for explicit selection without changing raw amounts', () => {
    const [token] = buildDustSweepCandidates(
      response([
        { key: 'scaled', value: '4', riskLevel: ETokenRiskLevel.UNKNOWN },
      ]),
      'sol--101',
    );
    expect(token.suspicious).toBe(true);
    expect(token.amount).toBe('1.234567');
    expect(token.balanceMultiplier).toBeUndefined();
    expect(token.valueUsd).toBe('4');
  });
  it('does not expose scaled tokens that the existing Swap pipeline cannot execute', () => {
    expect(
      buildDustSweepCandidates(
        response([{ key: 'scaled', value: '4', balanceMultiplier: '3' }]),
        'sol--101',
      ),
    ).toEqual([]);
  });
  it.each(['NaN', 'Infinity', '-1', '0'])(
    'rejects nonpositive or invalid USD value %s',
    (value) => {
      expect(
        buildDustSweepCandidates(response([{ key: 'bad', value }]), 'evm--1'),
      ).toEqual([]);
    },
  );
  it.each([
    ['0', false],
    ['0.1', true],
    ['5', true],
    ['50', true],
    ['50.01', false],
    ['', false],
    ['Infinity', false],
  ])('validates slippage %s', (value, valid) => {
    expect(isValidDustSweepSlippage(value as string)).toBe(valid);
  });
});
