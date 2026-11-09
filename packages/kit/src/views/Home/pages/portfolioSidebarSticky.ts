// The web home pager (react-native-pager-view WebCollapsiblePagerPage)
// publishes the measured height of its sticky tab bar on the page scroller
// as this CSS variable, so the sidebar can stick right below the tab bar
// without any JS measurement.
export const HOME_PAGER_STICKY_INSET_CSS_VAR =
  '--ok-collapsible-pager-sticky-inset';

// Breathing room between the stuck sidebar and the tab bar / scroller bottom.
export const PORTFOLIO_SIDEBAR_STICKY_GAP = 8;
export const PORTFOLIO_SIDEBAR_BOTTOM_GAP = 16;

const stickyInset = `var(${HOME_PAGER_STICKY_INSET_CSS_VAR}, 0px)`;

export type IPortfolioSidebarStickyStyle = {
  position: 'sticky';
  top: string;
  maxHeight?: string;
  overflow?: 'auto';
};

// Pure CSS sticky positioning for the desktop "Recent activity" sidebar.
//
// The previous implementation measured `getBoundingClientRect()` on scroll /
// resize and switched to `position: fixed` with viewport coordinates. That
// broke in two ways: inside the home pager a transformed scroller is the
// containing block of fixed descendants, so the pinned sidebar landed off to
// the right and scrolled away with the content (OK-65110); and a measurement
// taken while the Home tab was inactive (`content-visibility: hidden` keeps
// stale layout) pinned the sidebar at wrong coordinates that nothing
// corrected until the next user scroll (OK-63164, OK-65383).
//
// `scrollerHeight` caps the stuck sidebar so a long list scrolls inside the
// viewport instead of being cut off; pass 0 when unknown to skip the cap.
export function buildPortfolioSidebarStickyStyle({
  scrollerHeight,
}: {
  scrollerHeight: number;
}): IPortfolioSidebarStickyStyle {
  const style: IPortfolioSidebarStickyStyle = {
    position: 'sticky',
    top: `calc(${stickyInset} + ${PORTFOLIO_SIDEBAR_STICKY_GAP}px)`,
  };
  if (scrollerHeight > 0) {
    style.maxHeight = `calc(${scrollerHeight}px - ${stickyInset} - ${
      PORTFOLIO_SIDEBAR_STICKY_GAP + PORTFOLIO_SIDEBAR_BOTTOM_GAP
    }px)`;
    style.overflow = 'auto';
  }
  return style;
}
