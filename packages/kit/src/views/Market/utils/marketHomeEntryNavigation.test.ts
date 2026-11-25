import {
  EMarketHomeEntrySource,
  resetMarketHomeEntryState,
  takeMarketHomeEntry,
} from '@onekeyhq/shared/src/logger/scopes/market/marketHomeEntry';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import {
  isMarketHomeFocusedInState,
  markMarketHomeDeeplinkEntry,
} from './marketHomeEntryNavigation';

let mockRootState: unknown;

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: { getRootState: () => mockRootState },
  },
}));

function buildRootState({
  tab = ETabRoutes.Market,
  marketTop = ETabMarketRoutes.TabMarket,
  overlay,
}: {
  tab?: ETabRoutes;
  marketTop?: ETabMarketRoutes;
  overlay?: ERootRoutes;
} = {}) {
  const marketRoutes: Array<{ name: string }> = [
    { name: ETabMarketRoutes.TabMarket },
  ];
  if (marketTop !== ETabMarketRoutes.TabMarket) {
    marketRoutes.push({ name: marketTop });
  }
  const main = {
    name: ERootRoutes.Main,
    state: {
      index: tab === ETabRoutes.Market ? 1 : 0,
      routes: [
        { name: tab === ETabRoutes.Market ? ETabRoutes.Home : tab },
        {
          name: ETabRoutes.Market,
          state: { index: marketRoutes.length - 1, routes: marketRoutes },
        },
      ],
    },
  };
  return overlay
    ? { index: 1, routes: [main, { name: overlay }] }
    : { index: 0, routes: [main] };
}

describe('isMarketHomeFocusedInState', () => {
  it('is focused when the Market home is the focused leaf', () => {
    expect(isMarketHomeFocusedInState(buildRootState())).toBe(true);
  });

  it.each([
    ['another tab', buildRootState({ tab: ETabRoutes.Home })],
    [
      'a Market detail above the home',
      buildRootState({ marketTop: ETabMarketRoutes.MarketDetailV2 }),
    ],
    [
      'a stock detail above the home',
      buildRootState({ marketTop: ETabMarketRoutes.MarketStockDetail }),
    ],
    ['a root modal', buildRootState({ overlay: ERootRoutes.Modal })],
    ['no navigation state', undefined],
  ])('is not focused with %s', (_, state) => {
    expect(isMarketHomeFocusedInState(state)).toBe(false);
  });
});

describe('markMarketHomeDeeplinkEntry', () => {
  beforeEach(() => {
    resetMarketHomeEntryState();
    mockRootState = undefined;
  });

  it('does not leave a marker when the Market home is already focused', () => {
    mockRootState = buildRootState();
    markMarketHomeDeeplinkEntry();
    expect(takeMarketHomeEntry()).toBeUndefined();
  });

  it('marks a deep link entry when the Market home is not focused', () => {
    mockRootState = buildRootState({ tab: ETabRoutes.Home });
    markMarketHomeDeeplinkEntry();
    expect(takeMarketHomeEntry()).toBe(EMarketHomeEntrySource.Deeplink);
  });

  it('marks a deep link entry while a Market detail covers the home', () => {
    mockRootState = buildRootState({
      marketTop: ETabMarketRoutes.MarketDetailV2,
    });
    markMarketHomeDeeplinkEntry();
    expect(takeMarketHomeEntry()).toBe(EMarketHomeEntrySource.Deeplink);
  });

  it('marks a deep link entry before navigation is ready', () => {
    markMarketHomeDeeplinkEntry();
    expect(takeMarketHomeEntry()).toBe(EMarketHomeEntrySource.Deeplink);
  });
});
