const MARKET_HOME_DESKTOP_CONTENT_MAX_WIDTH = 1480;

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

// Portalled sticky content is mounted under a plain DOM node, where
// `alignSelf` has no flex parent to center against. Auto margins keep the
// toolbar and table header on the same 1240px band as the list rows.
export const MARKET_DESKTOP_PORTAL_CONTENT_FRAME_PROPS = {
  ...MARKET_DESKTOP_CONTENT_FRAME_PROPS,
  mx: 'auto',
} as const;

// The desktop list-page tab region is 60px tall in the design: a 44px tab
// item with 8px above and below it.
export const MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE = {
  position: 'relative',
  py: '$2',
} as const;
