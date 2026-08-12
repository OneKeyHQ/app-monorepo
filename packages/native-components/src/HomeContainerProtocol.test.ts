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
        title: 'Tokens',
        state: 'ready',
        emptyText: 'No tokens',
        showMoreTitle: 'Show more',
        showLessTitle: 'Show less',
        initialVisibleItemCount: 6,
        items: [
          {
            id: 'eth',
            symbol: 'ETH',
            iconUrl: 'https://example.com/eth.png',
            networkIconUrl: '',
            priceText: '$1,234.56',
            priceChangeText: '+1.00%',
            priceChangeDirection: 'positive',
            balanceText: '1',
            valueText: '$1,234.56',
            valuationState: 'ready',
            enabled: true,
          },
        ],
      },
      theme: {
        colorScheme: 'dark',
        backgroundColor: '#000000',
        surfaceColor: '#1C1C1E',
        primaryTextColor: '#FFFFFF',
        secondaryTextColor: '#8E8E93',
        disabledTextColor: '#636366',
        successTextColor: '#3DD68C',
        criticalTextColor: '#FF9592',
        accentColor: '#44D62C',
      },
    } satisfies INativeHomeViewModel;

    expect(state.owner).toEqual({
      scopeKey: 'home|wallet|account|owner|network',
      sessionId: 'session-1',
    });
    expect(state.tabs).toHaveLength(1);
    expect(state.portfolio.items[0]?.id).toBe('eth');
    expect('sections' in state).toBe(false);
  });
});
