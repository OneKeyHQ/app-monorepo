import { ZCASH_SAPLING_ACTIVATION_HEIGHT_MAINNET } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET } from '@onekeyhq/shared/src/config/zcash';

import {
  ZCASH_BIRTHDAY_SAFETY_BLOCKS,
  ZCASH_BLOCKS_PER_DAY,
  clampZcashBirthdayHeight,
  estimateZcashBirthdayHeight,
  estimateZcashChainTipFromClock,
} from './birthday';

describe('estimateZcashBirthdayHeight', () => {
  const now = Date.UTC(2026, 7, 21);
  const chainTip = 3_000_000;

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

  it('never estimates below Orchard activation', () => {
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: Date.UTC(2010, 0, 1),
        now,
        chainTip,
      }),
    ).toBe(ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET);
  });

  it('estimates the tip from the clock when the network tip is missing', () => {
    const clockTip = estimateZcashChainTipFromClock(now);
    expect(clockTip).toBeGreaterThan(ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET);
    expect(
      estimateZcashBirthdayHeight({
        birthdayTimestamp: now,
        now,
        chainTip: null,
      }),
    ).toBe(clockTip - ZCASH_BIRTHDAY_SAFETY_BLOCKS);
  });

  it('keeps the product floor above the unsupported Sapling era', () => {
    expect(ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET).toBeGreaterThan(
      ZCASH_SAPLING_ACTIVATION_HEIGHT_MAINNET,
    );
  });
});

describe('clampZcashBirthdayHeight', () => {
  it('keeps an explicit scan-from-start choice at the Orchard floor', () => {
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET,
        chainTip: 3_000_000,
      }),
    ).toBe(ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET);
  });

  it('does not move an in-range birthday', () => {
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: 2_000_000,
        chainTip: 3_000_000,
      }),
    ).toBe(2_000_000);
  });

  it('clamps unsupported history and future heights', () => {
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: ZCASH_SAPLING_ACTIVATION_HEIGHT_MAINNET,
      }),
    ).toBe(ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET);
    expect(
      clampZcashBirthdayHeight({
        birthdayHeight: 3_100_000,
        chainTip: 3_000_000,
      }),
    ).toBe(3_000_000);
  });
});
