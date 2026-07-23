import {
  adaptHomeShellToReactHeader,
  resolveHomeBalancePresentation,
} from '../compatibility/homeShellRenderAdapter';

import type { IHomeShellSemanticModel } from '../semantic/homeSemanticTypes';

describe('home shell React adapter', () => {
  it('maps the zero shell to the React zero family', () => {
    const shell: IHomeShellSemanticModel = {
      kind: 'portfolio',
      presentation: {
        kind: 'zero',
        header: { kind: 'zero', balance: { amount: '0', currency: 'usd' } },
        actions: { kind: 'zero', items: ['addMoney', 'receive', 'more'] },
        banner: { kind: 'none' },
        freshness: 'live',
        refresh: 'idle',
      },
    };

    expect(adaptHomeShellToReactHeader(shell)).toMatchObject({
      actionFamily: 'zero',
      balanceState: 'zero',
      showPositiveBanner: false,
    });
  });

  it('never exposes a partial total while retaining funded-safe actions', () => {
    const shell: IHomeShellSemanticModel = {
      kind: 'portfolio',
      presentation: {
        kind: 'fundedPendingTotal',
        header: { kind: 'loading' },
        actions: {
          kind: 'funded',
          items: ['send', 'receive', 'buySell', 'swap'],
        },
        banner: { kind: 'positive' },
      },
    };

    expect(adaptHomeShellToReactHeader(shell)).toEqual({
      actionFamily: 'funded',
      balance: undefined,
      balanceState: 'positive',
      showPositiveBanner: true,
    });
  });

  it('maps unavailable and special shells to loading without guessing zero', () => {
    expect(
      adaptHomeShellToReactHeader({ kind: 'missingNetworkAccount' }),
    ).toEqual({
      actionFamily: 'loading',
      balanceState: 'unknown',
      showPositiveBanner: false,
    });
  });

  it('builds one correlated amount/action/banner presentation from Store Shell', () => {
    const ownerToken = { scopeKey: 'owner-1', sessionId: 'session-1' };
    expect(
      resolveHomeBalancePresentation({
        ownerToken,
        shell: { kind: 'loading' },
      }),
    ).toMatchObject({
      balanceState: 'unknown',
      correlated: {
        kind: 'loading',
        balanceState: 'unknown',
        showPositiveBanner: false,
      },
    });

    const zero = resolveHomeBalancePresentation({
      ownerToken,
      shell: {
        kind: 'portfolio',
        presentation: {
          kind: 'zero',
          header: { kind: 'zero', balance: { amount: '0', currency: 'usd' } },
          actions: { kind: 'zero', items: ['addMoney', 'receive', 'more'] },
          banner: { kind: 'none' },
        },
      },
    });
    expect(zero).toMatchObject({
      balanceState: 'zero',
      correlated: {
        kind: 'ready',
        balance: { amount: '0', currency: 'usd' },
        balanceState: 'zero',
        showPositiveBanner: false,
      },
    });
    expect(zero.correlated?.revision).toEqual(expect.any(String));
  });

  it('shows a progressive zero once the balance currency owner is ready', () => {
    expect(
      resolveHomeBalancePresentation({
        fallbackCurrency: 'usd',
        ownerToken: { scopeKey: 'owner-1', sessionId: 'session-1' },
        shell: { kind: 'loading' },
      }),
    ).toMatchObject({
      balanceState: 'unknown',
      correlated: {
        kind: 'ready',
        balance: { amount: '0', currency: 'usd' },
        balanceState: 'unknown',
        showPositiveBanner: false,
      },
    });
  });

  it('exposes a progressive funded amount from the Store shell', () => {
    expect(
      resolveHomeBalancePresentation({
        fallbackCurrency: 'usd',
        shell: {
          kind: 'portfolio',
          presentation: {
            kind: 'fundedPendingTotal',
            header: {
              kind: 'loading',
              balance: { amount: '12.5', currency: 'usd' },
            },
            actions: {
              kind: 'funded',
              items: ['send', 'receive', 'buySell', 'swap'],
            },
            banner: { kind: 'none' },
            refresh: 'refreshing',
          },
        },
      }),
    ).toMatchObject({
      balanceState: 'positive',
      correlated: {
        kind: 'ready',
        balance: { amount: '12.5', currency: 'usd' },
        balanceState: 'positive',
      },
    });
  });
});
