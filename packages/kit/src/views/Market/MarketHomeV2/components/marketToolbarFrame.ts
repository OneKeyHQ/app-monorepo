// Shared geometry for the sub-category toolbars under the Market tabs
// (Favorites / Trending / Stocks / Perps). One source of truth here is what
// keeps the four tabs aligned: same box height, and the table header below it
// lands on the same y on every tab.
//
// The gaps below are only half of each spacing. Two containers outside every
// toolbar contribute the rest:
//   - the sticky-header portal target adds 8px above
//     (DESKTOP_STICKY_HEADER_TOP_GAP in DesktopLayout, shared by all tabs)
//   - the portal wrapper adds 12px below (mb="$3" in MarketTokenListBase)
// so the effective gaps are 16px above the box and 20px below it.
export const MARKET_TOOLBAR_GAP_TOP = 8;
export const MARKET_TOOLBAR_GAP_BOTTOM = 8;

// Pinned rather than derived from content: the trending bar holds 26px chips
// on a 6px inset while the category bars hold pills on a 4px inset, and only a
// fixed height guarantees those two never drift apart.
export const MARKET_TOOLBAR_HEIGHT = 40;

// Category pills sit inside the 4px inset, so 30px lands the box on 40.
export const MARKET_TOOLBAR_ITEM_HEIGHT = 30;

export const marketToolbarFrameProps = {
  height: MARKET_TOOLBAR_HEIGHT,
  maxWidth: '100%',
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: '$neutral4',
  borderRadius: '$3',
} as const;
