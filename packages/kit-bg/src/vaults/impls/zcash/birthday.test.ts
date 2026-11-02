import { ZCASH_SAPLING_ACTIVATION_HEIGHT_MAINNET } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import {
  ZCASH_IRONWOOD_ACTIVATION_HEIGHT_MAINNET,
  ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
  ZCASH_NU7_ACTIVATION_TIMESTAMP_MS,
} from '@onekeyhq/shared/src/config/zcash';

import {
  clampZcashBirthdayHeight,
  estimateZcashBirthdayHeight,
  estimateZcashChainTipFromClock,
} from './birthday';

const DAY_MS = 24 * 60 * 60 * 1000;
// 75s blocks before NU7, 25s after.
const ZCASH_BLOCKS_PER_DAY = 1152;
const POST_NU7_BLOCKS_PER_DAY = 3456;
const ZCASH_BIRTHDAY_SAFETY_BLOCKS = ZCASH_BLOCKS_PER_DAY;

describe('estimateZcashBirthdayHeight', () => {
  const now = Date.UTC(2026, 7, 21);
  const chainTip = estimateZcashChainTipFromClock(now) + 10_000;

  it('keeps one day of safety margin for a current-month restore', () => {
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: now,
        now,
        chainTip,
      }),
    ).toBe(chainTip - ZCASH_BIRTHDAY_SAFETY_BLOCKS);
  });

  it('moves the lower bound back by elapsed whole days', () => {
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: now - 10 * 24 * 60 * 60 * 1000,
        now,
        chainTip,
      }),
    ).toBe(chainTip - 10 * ZCASH_BLOCKS_PER_DAY - ZCASH_BIRTHDAY_SAFETY_BLOCKS);
  });

  it('never estimates below Ironwood activation', () => {
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: Date.UTC(2010, 0, 1),
        now,
        chainTip,
      }),
    ).toBe(ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET);
  });

  it('estimates the tip from the clock when the network tip is missing', () => {
    const clockTip = estimateZcashChainTipFromClock(now);
    expect(clockTip).toBeGreaterThan(ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET);
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: now,
        now,
        chainTip: null,
      }),
    ).toBe(clockTip - ZCASH_BIRTHDAY_SAFETY_BLOCKS);
  });

  it('ignores a stale saved tip below the clock estimate', () => {
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: now,
        now,
        chainTip: 3_000_000,
      }),
    ).toBe(estimateZcashChainTipFromClock(now) - ZCASH_BIRTHDAY_SAFETY_BLOCKS);
  });

  it('counts 25s blocks after NU7', () => {
    const later = ZCASH_NU7_ACTIVATION_TIMESTAMP_MS + 30 * DAY_MS;
    const tip = estimateZcashChainTipFromClock(later) + 10_000;
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: later - 10 * DAY_MS,
        now: later,
        chainTip: tip,
      }),
    ).toBe(tip - 11 * POST_NU7_BLOCKS_PER_DAY);
  });

  it('splits a window that spans NU7 at the activation time', () => {
    const later = ZCASH_NU7_ACTIVATION_TIMESTAMP_MS + 2 * DAY_MS;
    const tip = estimateZcashChainTipFromClock(later) + 10_000;
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: later - 5 * DAY_MS,
        now: later,
        chainTip: tip,
      }),
    ).toBe(tip - 4 * ZCASH_BLOCKS_PER_DAY - 2 * POST_NU7_BLOCKS_PER_DAY);
  });

  it('advances the clock tip three times faster after NU7', () => {
    const later = ZCASH_NU7_ACTIVATION_TIMESTAMP_MS + 10 * DAY_MS;
    const before =
      estimateZcashChainTipFromClock(ZCASH_NU7_ACTIVATION_TIMESTAMP_MS) -
      estimateZcashChainTipFromClock(
        ZCASH_NU7_ACTIVATION_TIMESTAMP_MS - DAY_MS,
      );
    const after =
      estimateZcashChainTipFromClock(later + DAY_MS) -
      estimateZcashChainTipFromClock(later);
    expect(Math.abs(after - 3 * before)).toBeLessThanOrEqual(3);
  });

  it('keeps the product floor at Ironwood and above the unsupported Sapling era', () => {
    expect(ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET).toBe(3_428_143);
    expect(ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET).toBeGreaterThan(
      ZCASH_SAPLING_ACTIVATION_HEIGHT_MAINNET,
    );
  });

  it('never moves an offline estimate below Ironwood when the clock is stale', () => {
    const beforeActivation = Date.UTC(2026, 6, 27);
    expect(estimateZcashChainTipFromClock(beforeActivation)).toBe(
      ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
    );
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: beforeActivation,
        now: beforeActivation,
        chainTip: 3_000_000,
      }),
    ).toBe(ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET);
  });
});

describe('clampZcashBirthdayHeight', () => {
  it('keeps a full scan at the Ironwood floor', () => {
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
        chainTip: 3_700_000,
      }),
    ).toBe(ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET);
  });

  it('clamps unsupported pre-Ironwood birthdays to the product floor', () => {
    const chainTip = ZCASH_IRONWOOD_ACTIVATION_HEIGHT_MAINNET + 1000;
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: ZCASH_IRONWOOD_ACTIVATION_HEIGHT_MAINNET,
        chainTip,
      }),
    ).toBe(ZCASH_IRONWOOD_ACTIVATION_HEIGHT_MAINNET);
    expect(
      clampZcashBirthdayHeight({ birthdayHeight: 2_000_000, chainTip }),
    ).toBe(ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET);
  });

  it('does not move an in-range birthday', () => {
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: 3_500_000,
        chainTip: 3_700_000,
      }),
    ).toBe(3_500_000);
  });

  it('does not lower the product floor for a stale pre-Ironwood chain tip', () => {
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
        chainTip: 3_000_000,
      }),
    ).toBe(ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET);
  });

  it('clamps unsupported history and future heights', () => {
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: ZCASH_SAPLING_ACTIVATION_HEIGHT_MAINNET,
      }),
    ).toBe(ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET);
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: 3_800_000,
        chainTip: 3_700_000,
      }),
    ).toBe(3_700_000);
  });
});
