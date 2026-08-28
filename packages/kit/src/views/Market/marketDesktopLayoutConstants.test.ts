import { MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE } from './marketDesktopLayoutConstants';

describe('marketDesktopLayoutConstants', () => {
  it('gives the desktop tab bar the design 60px band', () => {
    // 44px tab item + 8px above and below, and a positioned container so the
    // sticky header portal anchors to it instead of the page.
    expect(MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE).toEqual({
      position: 'relative',
      py: '$2',
    });
  });
});
