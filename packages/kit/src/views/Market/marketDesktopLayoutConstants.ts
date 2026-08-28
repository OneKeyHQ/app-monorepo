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
