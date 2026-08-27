// Every desktop Market surface (home list, token detail, stock detail) renders
// its content inside the same frame: a fixed 1240 band centered in the viewport,
// instead of a viewport-relative width that kept growing on wide screens.
// Windows narrower than the band still shrink naturally, because the frame is
// `width: 100%` capped by `maxWidth`.
export const MARKET_DESKTOP_CONTENT_MAX_WIDTH = 1240;

// Spread this on every element that has to sit on the band: content columns and
// the sticky column headers portalled above them. Sharing one object is what
// keeps a sticky header aligned with the rows it labels.
export const MARKET_DESKTOP_CONTENT_FRAME_PROPS = {
  width: '100%',
  maxWidth: MARKET_DESKTOP_CONTENT_MAX_WIDTH,
  alignSelf: 'center',
} as const;
