// Mirrors `<Page.Container layout="regular">` so Home can keep the same visual
// content width while using a full-width scroll container for side gutters.
const HOME_PAGE_CONTENT_MAX_WIDTH = 1140;
// From 1280 on the web, the trade column docks at the page's right edge and
// the content keeps to this width (800 inside its 20 side padding), centered
// in the space beside it: room for a large balance and its four actions.
const HOME_PAGE_DOCKED_CONTENT_MAX_WIDTH = 840;

const homePageContentMaxWidthSx = {
  width: '100%' as const,
  $gtMd: {
    maxWidth: HOME_PAGE_CONTENT_MAX_WIDTH,
    width: '100%' as const,
    mx: 'auto' as const,
  },
  // Native media stops short of gtXl, so only the web takes it.
  $gtXl: {
    maxWidth: HOME_PAGE_DOCKED_CONTENT_MAX_WIDTH,
  },
};

export {
  HOME_PAGE_CONTENT_MAX_WIDTH,
  HOME_PAGE_DOCKED_CONTENT_MAX_WIDTH,
  homePageContentMaxWidthSx,
};
