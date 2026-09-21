import {
  ZCASH_SPAM_REGION_END_MAINNET,
  ZCASH_SPAM_REGION_START_MAINNET,
  isZcashSpamRegionHeight,
} from './zcash';

describe('isZcashSpamRegionHeight', () => {
  it('includes both ends of the measured range', () => {
    expect(isZcashSpamRegionHeight(ZCASH_SPAM_REGION_START_MAINNET)).toBe(true);
    expect(isZcashSpamRegionHeight(ZCASH_SPAM_REGION_END_MAINNET)).toBe(true);
  });

  it('excludes heights on either side of it', () => {
    expect(isZcashSpamRegionHeight(ZCASH_SPAM_REGION_START_MAINNET - 1)).toBe(
      false,
    );
    expect(isZcashSpamRegionHeight(ZCASH_SPAM_REGION_END_MAINNET + 1)).toBe(
      false,
    );
  });

  it('says nothing about a height that was never read', () => {
    expect(isZcashSpamRegionHeight(null)).toBe(false);
    expect(isZcashSpamRegionHeight(undefined)).toBe(false);
  });
});
