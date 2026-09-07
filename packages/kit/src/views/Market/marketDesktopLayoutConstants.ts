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
