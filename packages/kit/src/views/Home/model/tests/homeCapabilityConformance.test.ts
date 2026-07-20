import { adaptHomeNavigationToLegacy } from '../compatibility/homeLegacyNavigationAdapter';
import { adaptHomeNavigationToNative } from '../native/homeNativeNavigationAdapter';

describe('homeCapabilityConformance', () => {
  it.each(['inline', 'web', 'unavailable'] as const)(
    'keeps Legacy and Native navigation equivalent for %s Perps',
    (perpsDestination) => {
      const tabs =
        perpsDestination === 'unavailable'
          ? (['portfolio', 'history'] as const)
          : (['portfolio', 'perps', 'history'] as const);
      const navigation = {
        destinations: Object.fromEntries(
          tabs.map((tabId) => [
            tabId,
            tabId === 'perps' && perpsDestination === 'web' ? 'web' : 'inline',
          ]),
        ),
        freshness: 'live' as const,
        kind: 'ready' as const,
        perpsDestination,
        refresh: 'idle' as const,
        sections: {
          defi: false,
          history: true,
          market: true,
          nft: false,
          perps: perpsDestination === 'inline',
          portfolio: true,
        },
        selectedTabId: 'portfolio' as const,
        tabs,
      };
      expect(adaptHomeNavigationToLegacy(navigation)).toEqual(
        adaptHomeNavigationToNative(navigation),
      );
    },
  );
});
