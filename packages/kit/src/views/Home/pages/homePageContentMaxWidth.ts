// Mirrors `<Page.Container layout="regular">` so Home can keep the same visual
// content width while using a full-width scroll container for side gutters.
const HOME_PAGE_CONTENT_MAX_WIDTH = 1140;

const homePageContentMaxWidthSx = {
  width: '100%' as const,
  $gtMd: {
    maxWidth: HOME_PAGE_CONTENT_MAX_WIDTH,
    width: '100%' as const,
    mx: 'auto' as const,
  },
};

export { HOME_PAGE_CONTENT_MAX_WIDTH, homePageContentMaxWidthSx };
