import { adaptHomeNavigationToLegacy } from '../compatibility/homeLegacyNavigationAdapter';
import { adaptHomeNavigationToNative } from '../native/homeNativeNavigationAdapter';

const ready = {
  destinations: { perps: 'web' as const, portfolio: 'inline' as const },
  freshness: 'live' as const,
  kind: 'ready' as const,
  perpsDestination: 'web' as const,
  refresh: 'idle' as const,
  sections: {
    defi: false,
    history: true,
    market: true,
    nft: false,
    perps: false,
    portfolio: true,
  },
  selectedTabId: 'portfolio' as const,
  tabs: ['portfolio', 'perps'] as const,
};

describe('homeNavigationAdapters', () => {
  it('does not commit tabs while capability authority is pending', () => {
    expect(adaptHomeNavigationToLegacy({ kind: 'hidden' })).toEqual({
      kind: 'pending',
      shouldCommitTabs: false,
    });
    expect(adaptHomeNavigationToNative(undefined)).toEqual({
      kind: 'pending',
      shouldCommitTabs: false,
    });
  });

  it('projects the same selected tab, order, and Perps destination', () => {
    expect(adaptHomeNavigationToLegacy(ready)).toEqual(
      adaptHomeNavigationToNative(ready),
    );
  });
});
