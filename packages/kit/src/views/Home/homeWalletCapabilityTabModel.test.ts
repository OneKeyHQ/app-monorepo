import {
  buildHomeWalletAtomicTabState,
  buildHomeWalletCapabilityNavigationModel,
  buildHomeWalletCapabilityTabModel,
  commitHomeWalletScopedWorth,
  resolveHomeWalletScopedWorth,
  resolveHomeWalletSelectedTab,
} from './homeWalletCapabilityTabModel';

const pendingSupport = {
  isReady: false,
  isDeFiSupported: false,
  isPerpsSupported: false,
};

const supportedEvm = {
  isReady: true,
  isDeFiSupported: true,
  isPerpsSupported: true,
};

const unsupportedBtc = {
  isReady: true,
  isDeFiSupported: false,
  isPerpsSupported: false,
};

describe('home wallet capability tab model', () => {
  it('keeps a cold single-network capability pending without committing final tabs', () => {
    expect(buildHomeWalletCapabilityTabModel(pendingSupport)).toEqual({
      status: 'pending',
      shouldCommitTabs: false,
      isDeFiVisible: false,
      isPerpsVisible: false,
    });
  });

  it('commits hidden capability tabs only after unsupported BTC is confirmed', () => {
    expect(buildHomeWalletCapabilityTabModel(unsupportedBtc)).toMatchObject({
      status: 'confirmed',
      shouldCommitTabs: true,
      isDeFiVisible: false,
      isPerpsVisible: false,
    });
  });

  it('does not borrow capability across EVM to BTC to EVM transitions', () => {
    expect(buildHomeWalletCapabilityTabModel(supportedEvm)).toMatchObject({
      status: 'confirmed',
      isDeFiVisible: true,
      isPerpsVisible: true,
    });
    expect(buildHomeWalletCapabilityTabModel(pendingSupport)).toMatchObject({
      status: 'pending',
      shouldCommitTabs: false,
    });
    expect(buildHomeWalletCapabilityTabModel(unsupportedBtc)).toMatchObject({
      status: 'confirmed',
      isDeFiVisible: false,
      isPerpsVisible: false,
    });
    expect(buildHomeWalletCapabilityTabModel(pendingSupport)).toMatchObject({
      status: 'pending',
      shouldCommitTabs: false,
    });
    expect(buildHomeWalletCapabilityTabModel(supportedEvm)).toMatchObject({
      status: 'confirmed',
      isDeFiVisible: true,
      isPerpsVisible: true,
    });
  });

  it('applies the Perps kill switch without hiding independently supported DeFi', () => {
    expect(
      buildHomeWalletCapabilityTabModel({
        ...supportedEvm,
        isPerpsSupported: false,
      }),
    ).toMatchObject({
      status: 'confirmed',
      shouldCommitTabs: true,
      isDeFiVisible: true,
      isPerpsVisible: false,
    });
  });

  it('keeps All Networks confirmed without entering the neutral pending surface', () => {
    expect(buildHomeWalletCapabilityTabModel(supportedEvm)).toMatchObject({
      status: 'confirmed',
      shouldCommitTabs: true,
      isDeFiVisible: true,
      isPerpsVisible: true,
    });
  });

  it('keeps a legal selected tab and falls back only after it is removed', () => {
    const visibleTabs = ['portfolio', 'nft', 'history'] as const;

    expect(
      resolveHomeWalletSelectedTab({
        selectedTabId: 'nft',
        visibleTabIds: visibleTabs,
        fallbackTabId: 'portfolio',
      }),
    ).toBe('nft');
    expect(
      resolveHomeWalletSelectedTab({
        selectedTabId: 'defi',
        visibleTabIds: visibleTabs,
        fallbackTabId: 'portfolio',
      }),
    ).toBe('portfolio');
  });

  it('consumes one authoritative navigation transaction for both renderers', () => {
    expect(
      buildHomeWalletCapabilityNavigationModel({
        destinations: { portfolio: 'inline', perps: 'web' },
        freshness: 'live',
        kind: 'ready',
        perpsDestination: 'web',
        refresh: 'idle',
        sections: {
          defi: false,
          history: true,
          market: true,
          nft: false,
          perps: false,
          portfolio: true,
        },
        selectedTabId: 'portfolio',
        tabs: ['portfolio', 'perps', 'history'],
      }),
    ).toEqual({
      perpsDestination: 'web',
      selectedTabId: 'portfolio',
      shouldCommitTabs: true,
      status: 'confirmed',
      tabIds: ['portfolio', 'perps', 'history'],
    });
  });

  it('mounts an explicit native loading row while capability is pending', () => {
    const state = buildHomeWalletAtomicTabState({
      tabShells: [
        { id: 'portfolio', title: '', destination: 'inline', sections: [] },
      ],
      sectionsByTab: {},
      shouldCommitTabs: false,
      selectedTabId: 'history',
    });

    expect(state).toMatchObject({
      selectedTabId: 'portfolio',
      tabs: [
        {
          id: 'portfolio',
          sections: [
            {
              items: [
                {
                  id: 'capability-pending-loading',
                  renderer: 'loading',
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('builds confirmed tabs, selected tab, and every current section atomically', () => {
    const state = buildHomeWalletAtomicTabState({
      tabShells: [
        {
          id: 'portfolio',
          title: 'Spot',
          destination: 'inline',
          sections: [],
        },
        { id: 'defi', title: 'DeFi', destination: 'inline', sections: [] },
        {
          id: 'history',
          title: 'History',
          destination: 'inline',
          sections: [],
        },
      ],
      sectionsByTab: {
        portfolio: [
          {
            id: 'assets-current',
            items: [{ id: 'eth', renderer: 'asset', title: 'ETH' }],
          },
        ],
        defi: [
          {
            id: 'defi-current',
            items: [{ id: 'aave', renderer: 'defi', title: 'Aave' }],
          },
        ],
        history: [
          {
            id: 'history-current',
            items: [{ id: 'tx', renderer: 'history', title: 'Send' }],
          },
        ],
      },
      shouldCommitTabs: true,
      selectedTabId: 'defi',
    });

    expect(state.selectedTabId).toBe('defi');
    expect(state.tabs.map((tab) => [tab.id, tab.sections[0]?.id])).toEqual([
      ['portfolio', 'assets-current'],
      ['defi', 'defi-current'],
      ['history', 'history-current'],
    ]);
  });

  it('does not attribute an old owner worth result to the next owner cache', () => {
    const ownerAResult = { scopeKey: 'owner-a', value: '123' };
    const ownerBCache = { scopeKey: 'owner-b', value: '8' };

    expect(
      resolveHomeWalletScopedWorth({
        result: ownerAResult,
        scopeKey: 'owner-b',
      }),
    ).toBeUndefined();
    expect(
      commitHomeWalletScopedWorth({
        result: ownerAResult,
        scopeKey: 'owner-b',
        current: ownerBCache,
      }),
    ).toBe(ownerBCache);
  });

  it('keeps handoff tabs section-free and out of native selection', () => {
    const state = buildHomeWalletAtomicTabState({
      tabShells: [
        {
          id: 'portfolio',
          title: 'Spot',
          destination: 'inline',
          sections: [],
        },
        {
          id: 'perps',
          title: 'Perps',
          destination: 'handoff',
          handoffCommandId: 'home.perps.openWeb',
          sections: [],
        },
      ],
      sectionsByTab: {
        perps: [{ id: 'invalid-handoff-content', items: [] }],
      },
      shouldCommitTabs: true,
      selectedTabId: 'perps',
    });

    expect(state.selectedTabId).toBe('portfolio');
    expect(state.tabs.find((tab) => tab.id === 'perps')?.sections).toEqual([]);
  });
});
