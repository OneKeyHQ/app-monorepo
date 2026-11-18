import {
  XMR_BIRTHDAY_SAFETY_BLOCKS,
  XMR_BLOCKS_PER_DAY,
  estimateXmrBirthdayHeight,
  estimateXmrHeightDaysAgo,
} from './birthday';

// A real mainnet block; the fixtures use it as the tip.
const realBlock = {
  height: 3_768_162,
  timestampMs: Date.UTC(2026, 8, 22, 16, 8, 22),
};
// Shortly after realBlock was mined.
const now = Date.UTC(2026, 8, 23);

describe('xmr birthday', () => {
  it.each([Date.UTC(2014, 3, 18), Date.UTC(2015, 0, 1), Date.UTC(2016, 2, 22)])(
    'keeps a birthday crossing the one-minute-block era safely early: %s',
    (birthdayTimestamp) => {
      expect(
        estimateXmrBirthdayHeight({
          birthdayTimestamp,
          now,
          chainTip: realBlock.height,
        }),
      ).toBe(1);
    },
  );
  it('counts back from the tip at the target block rate', () => {
    expect(XMR_BLOCKS_PER_DAY).toBe(720);
    expect(
      estimateXmrHeightDaysAgo({
        daysAgo: 10,
        chainTip: realBlock.height,
        now,
      }),
    ).toBe(realBlock.height - 10 * 720 - XMR_BIRTHDAY_SAFETY_BLOCKS);
  });

  it('never returns a height above the tip', () => {
    expect(estimateXmrHeightDaysAgo({ daysAgo: 0, chainTip: 1000, now })).toBe(
      1000 - XMR_BIRTHDAY_SAFETY_BLOCKS,
    );
    expect(estimateXmrHeightDaysAgo({ daysAgo: -5, chainTip: 1000, now })).toBe(
      1000 - XMR_BIRTHDAY_SAFETY_BLOCKS,
    );
  });

  it('clamps at genesis rather than going negative', () => {
    expect(
      estimateXmrHeightDaysAgo({
        daysAgo: 10_000,
        chainTip: realBlock.height,
        now,
      }),
    ).toBe(0);
  });

  // A birthday that leaves the start at the tip silently skips all history.
  it('turns a chosen month into a height well below the tip', () => {
    const chainTip = realBlock.height;
    const height = estimateXmrBirthdayHeight({
      birthdayTimestamp: Date.UTC(2024, 0, 1),
      now,
      chainTip,
    });
    expect(height).toBeLessThan(chainTip);
    expect(chainTip - height).toBe(996 * 720 + XMR_BIRTHDAY_SAFETY_BLOCKS);
  });

  it('rounds partial days up, so the start block can only be early', () => {
    const chainTip = realBlock.height;
    const halfADay = 12 * 60 * 60 * 1000;
    expect(
      estimateXmrBirthdayHeight({
        birthdayTimestamp: now - halfADay,
        now,
        chainTip,
      }),
    ).toBe(chainTip - 720 - XMR_BIRTHDAY_SAFETY_BLOCKS);
  });
  // Dates after the checkpoint count forward and run late, so a bad node's tip is riskiest there.
  it('never starts after the real block when the node inflates its tip', () => {
    expect(
      estimateXmrBirthdayHeight({
        birthdayTimestamp: realBlock.timestampMs,
        now,
        chainTip: 1_000_000_000,
      }),
    ).toBeLessThanOrEqual(realBlock.height);
  });
});
