import type {
  IHomeContainerNativeProps,
  INativeHomeIntent,
} from './HomeContainer.nitro';

describe('Native Home protocol', () => {
  it('keeps the first bridge state concrete and owner-scoped', () => {
    const props = {
      protocolVersion: 1,
      owner: {
        scopeKey: 'home|wallet|account|owner|network',
        sessionId: 'session-1',
      },
      navigation: {
        selectedTab: 'portfolio',
        tabs: [
          {
            id: 'portfolio',
            title: 'Portfolio',
            enabled: true,
          },
          {
            id: 'history',
            title: 'History',
            enabled: true,
          },
        ],
      },
      header: {
        state: 'ready',
        balanceText: '$1,234.56',
        balanceHidden: false,
        balanceActionId: 'toggleBalanceVisibility',
        balanceActionEnabled: true,
        bannerVisible: true,
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
      spotTokens: {
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
        deFiTokensFilter: {
          visible: true,
          title: 'DeFi tokens',
          selected: false,
          loading: false,
          enabled: true,
        },
        lowValueAssets: {
          visible: true,
          title: '8 Low-value assets',
          valueText: '$0.00',
          enabled: true,
        },
        riskAssets: {
          visible: true,
          title: '70 Collapsed risk assets',
          enabled: true,
        },
        manageTokens: {
          visible: true,
          instruction: "Can't find your token?",
          actionTitle: 'Add token',
          enabled: true,
        },
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
    } satisfies IHomeContainerNativeProps;

    expect(props.owner).toEqual({
      scopeKey: 'home|wallet|account|owner|network',
      sessionId: 'session-1',
    });
    expect(props.navigation.tabs).toHaveLength(2);
    expect(props.spotTokens.items[0]?.id).toBe('eth');
    expect('sections' in props).toBe(false);
  });

  it('keeps tab and refresh intents concrete and owner-scoped', () => {
    const selectionIntent = {
      owner: {
        scopeKey: 'home|wallet|account|owner|network',
        sessionId: 'session-1',
      },
      selectTabId: 'history',
    } satisfies INativeHomeIntent;
    const intent = {
      owner: {
        scopeKey: 'home|wallet|account|owner|network',
        sessionId: 'session-1',
      },
      refreshTabId: 'portfolio',
    } satisfies INativeHomeIntent;

    expect(selectionIntent.selectTabId).toBe('history');
    expect(intent).toEqual({
      owner: {
        scopeKey: 'home|wallet|account|owner|network',
        sessionId: 'session-1',
      },
      refreshTabId: 'portfolio',
    });
  });
});
