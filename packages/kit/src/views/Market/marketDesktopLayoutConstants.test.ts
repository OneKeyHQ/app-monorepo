import {
  MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE,
  MARKET_LIST_FIRST_COLUMN_WIDTH,
  MARKET_LIST_NAME_COLUMN_WIDTH,
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
  // Figma `Market / ListPageTable / TBody`, shared by the Trending, Stocks and
  // Top coins pages: the cell pads 8px, a 4px-padded button holds the 16px
  // glyph, then a 6px gap precedes the 40px logo.
  const CELL_PADDING = 8;
  const STAR_BUTTON_PADDING = 4;
  const GLYPH_SIZE = 16;
  const BUTTON_TO_NAME_GAP = 6;

  it('puts the star glyph and the logo on the design offsets', () => {
    const glyphStart = CELL_PADDING + STAR_BUTTON_PADDING;
    const logoStart =
      CELL_PADDING +
      STAR_BUTTON_PADDING +
      GLYPH_SIZE +
      STAR_BUTTON_PADDING +
      BUTTON_TO_NAME_GAP;
    expect(glyphStart).toBe(12);
    expect(logoStart).toBe(38);
    expect(MARKET_LIST_STAR_TO_LOGO_GAP).toBe(
      logoStart - (glyphStart + GLYPH_SIZE),
    );
  });

  it('keeps the one-cell and standalone-column lists on the same offsets', () => {
    // Stocks keeps the star and the logo in one cell: the glyph ends 4px inside
    // the 24px slot, so the cell gap carries the design's remaining 6px.
    expect(MARKET_LIST_STAR_SLOT_TO_LOGO_GAP).toBe(BUTTON_TO_NAME_GAP);
    expect(MARKET_LIST_STAR_SLOT_TO_LOGO_GAP).toBe(
      MARKET_LIST_STAR_TO_LOGO_GAP -
        (MARKET_LIST_STAR_SLOT_WIDTH - GLYPH_SIZE) / 2,
    );

    // Trending and Top coins keep a standalone star column, so the column
    // itself spends the distance and the name column starts its logo flush at
    // its own edge — landing the logo on the same 38px.
    expect(MARKET_LIST_STAR_COLUMN_WIDTH).toBe(
      CELL_PADDING +
        MARKET_LIST_STAR_SLOT_WIDTH +
        MARKET_LIST_STAR_SLOT_TO_LOGO_GAP,
    );
    expect(MARKET_LIST_STAR_COLUMN_WIDTH).toBe(38);
  });

  it('shares one fixed first column across the list pages', () => {
    // Fixed, not a share of the row: the pages carry different numbers of
    // metric columns, so a percentage would differ on each one.
    expect(MARKET_LIST_FIRST_COLUMN_WIDTH).toBe(320);
    expect(MARKET_LIST_NAME_COLUMN_WIDTH).toBe(
      MARKET_LIST_FIRST_COLUMN_WIDTH - MARKET_LIST_STAR_COLUMN_WIDTH,
    );
  });
});
