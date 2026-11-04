import { classifyWorth, resolveHomeBalanceState } from './homeBalanceState';

/*
yarn jest packages/kit/src/hooks/homeBalanceState.test.ts
*/

describe('classifyWorth', () => {
  it('has no evidence for missing or unparseable scalars', () => {
    expect(classifyWorth(undefined)).toBeUndefined();
    expect(classifyWorth(null)).toBeUndefined();
    expect(classifyWorth('')).toBeUndefined();
    expect(classifyWorth('--')).toBeUndefined();
    expect(classifyWorth('NaN')).toBeUndefined();
  });

  it('classifies scalar worth', () => {
    expect(classifyWorth('0')).toBe('zero');
    expect(classifyWorth('0.00')).toBe('zero');
    expect(classifyWorth('12.5')).toBe('positive');
  });

  it('has no evidence for an empty or fully unparseable map', () => {
    expect(classifyWorth({})).toBeUndefined();
    expect(classifyWorth({ a: '--', b: 'NaN' })).toBeUndefined();
  });

  it('classifies a per-network map by any positive entry', () => {
    expect(classifyWorth({ a: '0', b: '0' })).toBe('zero');
    expect(classifyWorth({ a: '0', b: '3' })).toBe('positive');
    // Unparseable entries are dropped, the rest still count.
    expect(classifyWorth({ a: '--', b: '0' })).toBe('zero');
    expect(classifyWorth({ a: '--', b: '0.5' })).toBe('positive');
  });
});

describe('resolveHomeBalanceState', () => {
  const none = {
    hasWallet: true,
    hasHoldings: false,
    confirmedWorth: undefined,
    liveIsPositive: undefined,
    persistedWorth: undefined,
  } as const;

  it('is unknown without a wallet, whatever the evidence says', () => {
    expect(
      resolveHomeBalanceState({
        ...none,
        hasWallet: false,
        hasHoldings: true,
        confirmedWorth: '0',
        persistedWorth: 'zero',
      }),
    ).toBe('unknown');
  });

  it('is unknown when no source has evidence', () => {
    expect(resolveHomeBalanceState(none)).toBe('unknown');
  });

  it('held tokens win over every worth source', () => {
    expect(
      resolveHomeBalanceState({
        ...none,
        hasHoldings: true,
        confirmedWorth: '0',
        liveIsPositive: false,
        persistedWorth: 'zero',
      }),
    ).toBe('positive');
  });

  it('uses the confirmed snapshot before live and persisted worth', () => {
    expect(
      resolveHomeBalanceState({
        ...none,
        confirmedWorth: '0',
        liveIsPositive: true,
        persistedWorth: 'positive',
      }),
    ).toBe('zero');
    expect(
      resolveHomeBalanceState({
        ...none,
        confirmedWorth: '4.2',
        liveIsPositive: false,
        persistedWorth: 'zero',
      }),
    ).toBe('positive');
  });

  it('uses live worth before persisted worth', () => {
    expect(
      resolveHomeBalanceState({
        ...none,
        liveIsPositive: false,
        persistedWorth: 'positive',
      }),
    ).toBe('zero');
    expect(
      resolveHomeBalanceState({
        ...none,
        liveIsPositive: true,
        persistedWorth: 'zero',
      }),
    ).toBe('positive');
  });

  // The Slack 09-22 report: an empty account under All Networks has no held
  // tokens, no confirmed snapshot and (after the switch reset) no live worth,
  // so the header stayed `unknown` for the whole fan-out. The per-account value
  // the selector row already showed as $0.00 must break that tie.
  it('falls back to the persisted account value when nothing else knows', () => {
    expect(resolveHomeBalanceState({ ...none, persistedWorth: 'zero' })).toBe(
      'zero',
    );
    expect(
      resolveHomeBalanceState({ ...none, persistedWorth: 'positive' }),
    ).toBe('positive');
  });
});
