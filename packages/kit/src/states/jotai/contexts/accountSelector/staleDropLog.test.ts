import {
  STALE_DROP_LOG_THROTTLE_MS,
  resetStaleDropLogThrottleForTest,
  takeStaleDropLogSlot,
} from './staleDropLog';

describe('stale drop log throttle', () => {
  beforeEach(() => {
    resetStaleDropLogThrottleForTest();
    jest.restoreAllMocks();
  });

  it('logs the first drop of a burst and suppresses the rest', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);

    expect(takeStaleDropLogSlot('home__0')).toBe(0);
    expect(takeStaleDropLogSlot('home__0')).toBeUndefined();
    expect(takeStaleDropLogSlot('home__0')).toBeUndefined();
  });

  it('reports how many drops were suppressed once the window passes', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);

    expect(takeStaleDropLogSlot('home__0')).toBe(0);
    takeStaleDropLogSlot('home__0');
    takeStaleDropLogSlot('home__0');

    nowSpy.mockReturnValue(1000 + STALE_DROP_LOG_THROTTLE_MS);
    expect(takeStaleDropLogSlot('home__0')).toBe(2);
    // The count resets with the entry that reported it.
    nowSpy.mockReturnValue(1000 + STALE_DROP_LOG_THROTTLE_MS * 2);
    expect(takeStaleDropLogSlot('home__0')).toBe(0);
  });

  it('throttles each key independently', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);

    expect(takeStaleDropLogSlot('home__0')).toBe(0);
    expect(takeStaleDropLogSlot('discover__0')).toBe(0);
    expect(takeStaleDropLogSlot('home__0')).toBeUndefined();
    expect(takeStaleDropLogSlot('discover__1')).toBe(0);
  });
});
