import { getPerpsInteractionOverlayOpenState } from './interactionOverlayState';

describe('getPerpsInteractionOverlayOpenState', () => {
  it('parses explicit TradingView overlay visibility state', () => {
    expect(getPerpsInteractionOverlayOpenState({ isOpen: true })).toBe(true);
    expect(getPerpsInteractionOverlayOpenState({ isOpen: false })).toBe(false);
  });

  it('parses TradingView overlay action state', () => {
    expect(getPerpsInteractionOverlayOpenState({ action: 'open' })).toBe(true);
    expect(getPerpsInteractionOverlayOpenState({ action: 'close' })).toBe(
      false,
    );
  });

  it('ignores malformed TradingView overlay payloads', () => {
    expect(getPerpsInteractionOverlayOpenState(undefined)).toBeUndefined();
    expect(
      getPerpsInteractionOverlayOpenState({ action: 'toggle' }),
    ).toBeUndefined();
  });
});
