import { resolveHomeOverviewBalanceRenderDecision } from '../model/compatibility/homeShellRenderAdapter';

import type { IHomeBalanceDisplayPresentation } from '../model/policies/homeDisplayModelPolicy';

function readyPresentation(amount: string): IHomeBalanceDisplayPresentation {
  return {
    kind: 'ready',
    authority: 'live',
    balance: { amount, currency: 'usd' },
    revision: `revision-${amount}`,
  };
}

describe('HomeOverviewContainer balance display presentation', () => {
  it('keeps the Store amount loading until the value is ready', () => {
    const balancePresentation: IHomeBalanceDisplayPresentation = {
      kind: 'loading',
      revision: 'revision-loading',
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
        balancePresentation: readyPresentation('0'),
        semanticDisplayAmount: '0',
      }),
    ).toEqual({
      amount: '0',
      revision: 'revision-0',
      showSkeleton: false,
    });
  });

  it('renders the progressive zero without classifying the wallet as empty', () => {
    expect(
      resolveHomeOverviewBalanceRenderDecision({
        balancePresentation: readyPresentation('0'),
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
        balancePresentation: readyPresentation('12.5'),
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
        balancePresentation: readyPresentation('12.5'),
      }),
    ).toEqual({ revision: 'revision-12.5', showSkeleton: true });
  });
});
