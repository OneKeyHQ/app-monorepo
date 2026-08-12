import type { INativeHomeViewModel } from './HomeContainer.nitro';

describe('Native Home protocol', () => {
  it('keeps the first bridge state concrete and owner-scoped', () => {
    const state = {
      protocolVersion: 1,
      owner: {
        scopeKey: 'home|wallet|account|owner|network',
        sessionId: 'session-1',
      },
      selectedTab: 'portfolio',
      header: {
        state: 'ready',
        balanceText: '$1,234.56',
        balanceHidden: false,
        balanceActionId: 'toggleBalanceVisibility',
        balanceActionEnabled: true,
        actionLayout: 'funded',
        actionSubtitle: '',
        actions: [
          {
            id: 'send',
            title: 'Send',
            icon: 'send',
            enabled: true,
          },
        ],
      },
      tabs: [
        {
          id: 'portfolio',
          title: 'Portfolio',
          enabled: true,
        },
      ],
      portfolio: {
        isDiagnostic: true,
        title: 'Portfolio shell',
        message: 'No business data is rendered in Slice 1.',
      },
      theme: {
        colorScheme: 'dark',
        backgroundColor: '#000000',
        surfaceColor: '#1C1C1E',
        primaryTextColor: '#FFFFFF',
        secondaryTextColor: '#8E8E93',
        disabledTextColor: '#636366',
        accentColor: '#44D62C',
      },
    } satisfies INativeHomeViewModel;

    expect(state.owner).toEqual({
      scopeKey: 'home|wallet|account|owner|network',
      sessionId: 'session-1',
    });
    expect(state.tabs).toHaveLength(1);
    expect('sections' in state).toBe(false);
  });
});
