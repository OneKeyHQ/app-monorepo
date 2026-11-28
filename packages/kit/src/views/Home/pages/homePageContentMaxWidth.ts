import { createContext, useContext } from 'react';

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
};

const homePageDockedContentMaxWidthSx = {
  ...homePageContentMaxWidthSx,
  // Native media stops short of gtXl, so only the web takes it.
  $gtXl: {
    maxWidth: HOME_PAGE_DOCKED_CONTENT_MAX_WIDTH,
  },
};

// True while the trade column sits beside the home content. Only the user's
// own home with a usable, backed-up wallet docks it; any other home keeps the
// regular width at every size.
const HomeTradeColumnDockedContext = createContext(false);

function useHomeTradeColumnDocked() {
  return useContext(HomeTradeColumnDockedContext);
}

export {
  HOME_PAGE_CONTENT_MAX_WIDTH,
  HOME_PAGE_DOCKED_CONTENT_MAX_WIDTH,
  HomeTradeColumnDockedContext,
  homePageContentMaxWidthSx,
  homePageDockedContentMaxWidthSx,
  useHomeTradeColumnDocked,
};
