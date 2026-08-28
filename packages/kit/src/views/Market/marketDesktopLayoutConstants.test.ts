import {
  MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE,
  MARKET_LIST_STAR_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_TO_LOGO_GAP,
  MARKET_LIST_STAR_SLOT_WIDTH,
  MARKET_LIST_STAR_TO_LOGO_GAP,
} from './marketDesktopLayoutConstants';

describe('marketDesktopLayoutConstants', () => {
  it('gives the desktop tab bar the design 60px band', () => {
    // 44px tab item + 8px above and below, and a positioned container so the
    // sticky header portal anchors to it instead of the page.
    expect(MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE).toEqual({
      position: 'relative',
      py: '$2',
    });
  });
});

describe('market list star layout', () => {
  it('reproduces the Trending star-to-logo distance on the plain-icon lists', () => {
    // Trending: a 40px column whose `pl="$2"` holds an IconButton with 4px
    // padding and a -5px margin, so its 16px glyph runs 7px..23px and the next
    // column's logo starts 17px later.
    expect(MARKET_LIST_STAR_TO_LOGO_GAP).toBe(40 - (8 - 5 + 4 + 16));

    // Stocks keeps the star and the logo in one cell: the glyph ends 4px inside
    // the 24px slot, so the cell gap carries the remaining 13px.
    expect(MARKET_LIST_STAR_SLOT_TO_LOGO_GAP).toBe(
      MARKET_LIST_STAR_TO_LOGO_GAP - (MARKET_LIST_STAR_SLOT_WIDTH - 16) / 2,
    );

    // Top coins keeps a standalone star column, so the column itself spends the
    // distance and the name column starts its logo flush at its own edge.
    expect(MARKET_LIST_STAR_COLUMN_WIDTH).toBe(
      8 + MARKET_LIST_STAR_SLOT_WIDTH + MARKET_LIST_STAR_SLOT_TO_LOGO_GAP,
    );
  });
});
