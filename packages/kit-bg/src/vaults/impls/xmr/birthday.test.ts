import {
  XMR_BIRTHDAY_SAFETY_BLOCKS,
  XMR_BLOCKS_PER_DAY,
  estimateXmrBirthdayHeight,
  estimateXmrHeightDaysAgo,
} from './birthday';

describe('xmr birthday', () => {
  it('counts back from the tip at the target block rate', () => {
    expect(XMR_BLOCKS_PER_DAY).toBe(720);
    expect(estimateXmrHeightDaysAgo({ daysAgo: 10, chainTip: 3_768_162 })).toBe(
      3_768_162 - 10 * 720 - XMR_BIRTHDAY_SAFETY_BLOCKS,
    );
  });

  it('never returns a height above the tip', () => {
    // A month picked today, or in the future by a wrong device clock.
    expect(estimateXmrHeightDaysAgo({ daysAgo: 0, chainTip: 1000 })).toBe(
      1000 - XMR_BIRTHDAY_SAFETY_BLOCKS,
    );
    expect(estimateXmrHeightDaysAgo({ daysAgo: -5, chainTip: 1000 })).toBe(
      1000 - XMR_BIRTHDAY_SAFETY_BLOCKS,
    );
  });

  it('clamps at genesis rather than going negative', () => {
    expect(
      estimateXmrHeightDaysAgo({ daysAgo: 10_000, chainTip: 3_768_162 }),
    ).toBe(0);
  });

  /**
   * The bug this exists for: the enable dialog collects a month and nothing
   * else, so a birthday that does not move the start block off the tip means
   * the scan silently skips the user's whole history.
   */
  it('turns a chosen month into a height well below the tip', () => {
    const now = Date.UTC(2026, 8, 23);
    const chainTip = 3_768_162;
    const height = estimateXmrBirthdayHeight({
      birthdayTimestamp: Date.UTC(2024, 0, 1),
      now,
      chainTip,
    });
    expect(height).toBeLessThan(chainTip);
    // 996 days at 720 blocks a day, plus the safety day.
    expect(chainTip - height).toBe(996 * 720 + XMR_BIRTHDAY_SAFETY_BLOCKS);
  });

  it('rounds partial days up, so the start block can only be early', () => {
    const chainTip = 3_768_162;
    const halfADay = 12 * 60 * 60 * 1000;
    expect(
      estimateXmrBirthdayHeight({
        birthdayTimestamp: 1_700_000_000_000 - halfADay,
        now: 1_700_000_000_000,
        chainTip,
      }),
    ).toBe(chainTip - 720 - XMR_BIRTHDAY_SAFETY_BLOCKS);
  });
});
