import { buildHomeWalletCapabilityNavigationModel } from './homeWalletCapabilityTabModel';

describe('home wallet capability navigation model', () => {
  it('keeps the renderer pending until Store Navigation is authoritative', () => {
    expect(buildHomeWalletCapabilityNavigationModel(undefined)).toEqual({
      status: 'pending',
      shouldCommitTabs: false,
    });
    expect(
      buildHomeWalletCapabilityNavigationModel({ kind: 'hidden' }),
    ).toEqual({ status: 'pending', shouldCommitTabs: false });
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
});
