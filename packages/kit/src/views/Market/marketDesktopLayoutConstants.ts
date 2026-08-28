const MARKET_HOME_DESKTOP_CONTENT_MAX_WIDTH = 1240;

// The Market desktop design caps the content band at 1240 (Figma 26288:22765
// "Max Width"), sitting inside the 1364px content area with 62px gutters —
// hence the 124px the width subtracts. Wide windows grow the gutters rather
// than the band. The same frame is shared by home lists, detail pages, and
// portalled sticky headers so their outer edges stay aligned.
export const MARKET_DESKTOP_CONTENT_FRAME_PROPS = {
  width: 'calc(100% - 124px)',
  maxWidth: MARKET_HOME_DESKTOP_CONTENT_MAX_WIDTH,
  alignSelf: 'center',
  mx: 'auto',
} as const;

// The desktop list-page tab region is 60px tall in the design: a 44px tab
// item with 8px above and below it.
export const MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE = {
  position: 'relative',
  py: '$2',
} as const;

// Desktop market tables put the favorite star in a slot of its own, ahead of
// the token logo. Trending is the reference because it is the only list whose
// star is wired to the watchlist: `MarketStarV2` renders an `IconButton`
// (`size="small"`, `variant="tertiary"`) whose 4px padding and -5px margin sit
// in a `pl="$2"` cell of a 40px column, so its 16px glyph ends 17px before the
// logo of the next column. The lists that draw a plain icon restate that 17px
// instead of inheriting it.
export const MARKET_LIST_STAR_TO_LOGO_GAP = 17;

// The plain-icon lists center a 16px (`$4`) glyph in this slot.
export const MARKET_LIST_STAR_SLOT_WIDTH = 24;

const MARKET_LIST_STAR_GLYPH_SIZE = 16;
const MARKET_LIST_STAR_SLOT_INSET =
  (MARKET_LIST_STAR_SLOT_WIDTH - MARKET_LIST_STAR_GLYPH_SIZE) / 2;
// `$2`, the horizontal padding a star column carries.
const MARKET_LIST_STAR_COLUMN_PADDING = 8;

// Gap from the star slot to the logo when both share one cell (Stocks). The
// glyph already ends 4px inside the slot, so the gap carries the rest.
export const MARKET_LIST_STAR_SLOT_TO_LOGO_GAP =
  MARKET_LIST_STAR_TO_LOGO_GAP - MARKET_LIST_STAR_SLOT_INSET;

// Width of a standalone star column holding that slot at `px="$2"`. The column
// itself carries the remaining distance, so the next column starts its logo
// flush at its own edge (`pl` 0) to land on the same 17px.
export const MARKET_LIST_STAR_COLUMN_WIDTH =
  MARKET_LIST_STAR_COLUMN_PADDING +
  MARKET_LIST_STAR_SLOT_WIDTH +
  MARKET_LIST_STAR_SLOT_TO_LOGO_GAP;
