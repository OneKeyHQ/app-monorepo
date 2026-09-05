const MARKET_HOME_DESKTOP_CONTENT_MAX_WIDTH = 1480;

export const MARKET_DESKTOP_CHART_MIN_HEIGHT = 360;

// The Market desktop design has 62px gutters inside its 1364px content area.
// Keep those gutters stable through ordinary desktop widths, then cap the
// content at 1480px so wide windows retain balanced breathing room. The same
// frame is shared by home lists, detail pages, and portalled sticky headers so
// their outer edges stay aligned.
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
// the token logo. The Figma `Market / ListPageTable / TBody` component is the
// reference and every list page shares it: the cell carries `px="$2"`, then a
// 4px-padded button around a 16px glyph, then a 6px gap before the name group.
// That puts the glyph 12px from the cell edge and the 40px logo at 38px, so the
// glyph ends 10px before the logo.
export const MARKET_LIST_STAR_TO_LOGO_GAP = 10;

// The lists center a 16px (`$4`) glyph in this slot — the design's 4px-padded
// star button.
export const MARKET_LIST_STAR_SLOT_WIDTH = 24;

const MARKET_LIST_STAR_GLYPH_SIZE = 16;
const MARKET_LIST_STAR_SLOT_INSET =
  (MARKET_LIST_STAR_SLOT_WIDTH - MARKET_LIST_STAR_GLYPH_SIZE) / 2;
// `$2`, the horizontal padding a star column carries.
const MARKET_LIST_STAR_COLUMN_PADDING = 8;

// Gap from the star slot to the logo when both share one cell (Stocks). The
// glyph already ends 4px inside the slot, so the gap carries the rest — the
// design's 6px between the star button and the name group.
export const MARKET_LIST_STAR_SLOT_TO_LOGO_GAP =
  MARKET_LIST_STAR_TO_LOGO_GAP - MARKET_LIST_STAR_SLOT_INSET;

// Width of a standalone star column holding that slot at `px="$2"`. The column
// itself carries the remaining distance, so the next column starts its logo
// flush at its own edge (`pl` 0) to land on the same 10px.
export const MARKET_LIST_STAR_COLUMN_WIDTH =
  MARKET_LIST_STAR_COLUMN_PADDING +
  MARKET_LIST_STAR_SLOT_WIDTH +
  MARKET_LIST_STAR_SLOT_TO_LOGO_GAP;

// The design's `Left Fixed` frame: the star and name share one column on every
// list page, and the metric columns flex in what is left. Keep this as an
// explicit pixel range rather than a share of the row — the pages carry
// different numbers of metric columns, so a percentage would resolve to a
// different width on each one.
export const MARKET_LIST_FIRST_COLUMN_MAX_WIDTH = 320;
export const MARKET_LIST_FIRST_COLUMN_MIN_WIDTH = 256;
export const MARKET_LIST_METRIC_COLUMN_MIN_WIDTH = 104;

// Keep the maximum-width alias for compact surfaces that do not participate in
// the responsive list layout.
export const MARKET_LIST_FIRST_COLUMN_WIDTH =
  MARKET_LIST_FIRST_COLUMN_MAX_WIDTH;

// What the name column gets once the standalone star column is subtracted.
export const MARKET_LIST_NAME_COLUMN_WIDTH =
  MARKET_LIST_FIRST_COLUMN_WIDTH - MARKET_LIST_STAR_COLUMN_WIDTH;

// The desktop list-page toolbar band. Stocks is the calibrated reference: a
// 32px category button sitting on 16px above and 20px below. Fixing the height
// rather than restating that padding keeps the band identical on pages whose
// toolbar content is taller (Trending's 40px filter row), so switching tabs
// never shifts the table underneath.
export const MARKET_DESKTOP_TOOLBAR_BAND_HEIGHT = 68;

// The calibrated category button: `px="$2.5" py="$1.5"` around a `$bodyMdMedium`
// label. Every toolbar row matches it so the band reads 16 / 32 / 20.
export const MARKET_LIST_TOOLBAR_ITEM_HEIGHT = 32;

export const MARKET_DESKTOP_TOOLBAR_BAND_STYLE = {
  height: MARKET_DESKTOP_TOOLBAR_BAND_HEIGHT,
  pt: '$4',
} as const;

// Pages with no toolbar close the gap to the design's 12px table inset
// (Figma `Table` y=308 over a `Tabs` frame ending at 308, `Left Fixed` y=12).
export const MARKET_DESKTOP_NO_TOOLBAR_TABLE_INSET = 12;

// Horizontal insets inside the content band, from the design: the toolbar's
// `Wrapper` sits at x=20 and the table's `Left Fixed` frame at x=12, so the
// category chips run 8px to the right of the first column. Every desktop list
// page takes both from here instead of restating a padding token.
export const MARKET_DESKTOP_TOOLBAR_INSET = '$5';
export const MARKET_DESKTOP_HEADER_INSET = '$3';

// The design's 36px `THeader` row, shared by every list page.
export const MARKET_LIST_HEADER_ROW_HEIGHT = 36;

// The design's 72px `TBody` row, shared by every desktop list page.
export const MARKET_LIST_ROW_HEIGHT = 72;
