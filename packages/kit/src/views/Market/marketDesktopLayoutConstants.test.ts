import {
  MARKET_DESKTOP_CONTENT_FRAME_PROPS,
  MARKET_DESKTOP_PORTAL_CONTENT_FRAME_PROPS,
  MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE,
} from './marketDesktopLayoutConstants';

describe('marketDesktopLayoutConstants', () => {
  it('centers portalled list controls without changing the base content frame', () => {
    expect(MARKET_DESKTOP_CONTENT_FRAME_PROPS).toEqual({
      width: '100%',
      maxWidth: 1240,
      alignSelf: 'center',
    });
    expect(MARKET_DESKTOP_PORTAL_CONTENT_FRAME_PROPS).toEqual({
      ...MARKET_DESKTOP_CONTENT_FRAME_PROPS,
      mx: 'auto',
    });
  });

  it('matches the 60px desktop list-page tab region', () => {
    expect(MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE).toEqual({
      position: 'relative',
      py: '$2',
    });
  });
});
