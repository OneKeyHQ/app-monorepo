import { shouldReplayFullscreenNavigationAction } from './marketDetailFullscreenNavigation';

describe('shouldReplayFullscreenNavigationAction', () => {
  it('replays replace actions after exiting fullscreen', () => {
    expect(
      shouldReplayFullscreenNavigationAction({
        type: 'REPLACE',
        payload: { name: 'MarketStockDetail' },
      }),
    ).toBe(true);
  });

  it('keeps back actions intercepted after exiting fullscreen', () => {
    expect(shouldReplayFullscreenNavigationAction({ type: 'GO_BACK' })).toBe(
      false,
    );
  });
});
