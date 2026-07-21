import { resolveHomeOverviewBalanceRenderDecision } from '../model/compatibility/homeShellRenderAdapter';

import type { IHomeCorrelatedBalancePresentation } from '../model/compatibility/homeShellRenderAdapter';

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
  it('keeps the Store amount loading until the correlated value is ready', () => {
    const balancePresentation: IHomeCorrelatedBalancePresentation = {
      kind: 'loading',
      balanceState: 'unknown',
      revision: 'revision-loading',
      showPositiveBanner: false,
    };

    expect(
      resolveHomeOverviewBalanceRenderDecision({
        balancePresentation,
      }),
    ).toEqual({ revision: 'revision-loading', showSkeleton: true });
  });

  it('uses the authoritative Store zero', () => {
    expect(
      resolveHomeOverviewBalanceRenderDecision({
        balancePresentation: readyPresentation('0', 'zero'),
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
        semanticDisplayAmount: '12.5',
      }),
    ).toEqual({
      amount: '12.5',
      revision: 'revision-12.5',
      showSkeleton: false,
    });
  });

  it('keeps loading when the Store presentation is absent', () => {
    expect(resolveHomeOverviewBalanceRenderDecision({})).toEqual({
      showSkeleton: true,
    });
  });

  it('does not relabel a semantic amount when display-currency quoting fails', () => {
    expect(
      resolveHomeOverviewBalanceRenderDecision({
        balancePresentation: readyPresentation('12.5', 'positive'),
      }),
    ).toEqual({ revision: 'revision-12.5', showSkeleton: true });
  });
});
