import { resolveHomeOverviewBalanceRenderDecision } from '../model/compatibility/homeLegacyShellAdapter';

import type { IHomeCorrelatedBalancePresentation } from '../model/compatibility/homeLegacyShellAdapter';

function readyPresentation(
  amount: string,
  balanceState: 'zero' | 'positive',
): IHomeCorrelatedBalancePresentation {
  return {
    kind: 'ready',
    balance: { amount, currency: 'usd' },
    balanceState,
    revision: `revision-${amount}`,
    showPositiveBanner: balanceState === 'positive',
  };
}

describe('HomeOverviewContainer correlated balance presentation', () => {
  it('suppresses an old Legacy amount while the semantic amount is loading', () => {
    const balancePresentation: IHomeCorrelatedBalancePresentation = {
      kind: 'loading',
      balanceState: 'unknown',
      revision: 'revision-loading',
      showPositiveBanner: false,
    };

    expect(
      resolveHomeOverviewBalanceRenderDecision({
        balancePresentation,
        legacyAmount: '88',
        legacyShowSkeleton: false,
      }),
    ).toEqual({ revision: 'revision-loading', showSkeleton: true });
  });

  it('uses authoritative semantic zero instead of a positive Legacy cache', () => {
    expect(
      resolveHomeOverviewBalanceRenderDecision({
        balancePresentation: readyPresentation('0', 'zero'),
        legacyAmount: '88',
        legacyShowSkeleton: false,
        semanticDisplayAmount: '0',
      }),
    ).toEqual({
      amount: '0',
      revision: 'revision-0',
      showSkeleton: false,
    });
  });

  it('uses the exact funded semantic amount and its revision', () => {
    expect(
      resolveHomeOverviewBalanceRenderDecision({
        balancePresentation: readyPresentation('12.5', 'positive'),
        legacyAmount: '88',
        legacyShowSkeleton: false,
        semanticDisplayAmount: '12.5',
      }),
    ).toEqual({
      amount: '12.5',
      revision: 'revision-12.5',
      showSkeleton: false,
    });
  });

  it('fully rolls back to the existing renderer when semantic facts are absent', () => {
    expect(
      resolveHomeOverviewBalanceRenderDecision({
        legacyAmount: '88',
        legacyShowSkeleton: false,
      }),
    ).toEqual({ amount: '88', showSkeleton: false });
    expect(
      resolveHomeOverviewBalanceRenderDecision({
        legacyShowSkeleton: true,
      }),
    ).toEqual({ amount: undefined, showSkeleton: true });
  });

  it('does not relabel a semantic amount when display-currency quoting fails', () => {
    expect(
      resolveHomeOverviewBalanceRenderDecision({
        balancePresentation: readyPresentation('12.5', 'positive'),
        legacyAmount: '88',
        legacyShowSkeleton: false,
      }),
    ).toEqual({ revision: 'revision-12.5', showSkeleton: true });
  });
});
