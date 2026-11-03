import { ZCASH_NU7_ACTIVATION_HEIGHT_MAINNET as NU7 } from '@onekeyhq/shared/src/config/zcash';

import { isZcashTransparentSendExpired } from './vaultTransparent';

jest.mock('../../../dbs/local/localDbInstance');

// The drop margin stands for time (indexer lag), so it keeps its time across NU7 (ZIP 218).
describe('isZcashTransparentSendExpired', () => {
  it('waits 10 blocks past expiry before NU7', () => {
    const expiry = NU7 - 100;
    expect(isZcashTransparentSendExpired(expiry, expiry + 10)).toBe(false);
    expect(isZcashTransparentSendExpired(expiry, expiry + 11)).toBe(true);
  });

  it('waits 30 blocks past expiry from NU7', () => {
    const expiry = NU7 + 100;
    expect(isZcashTransparentSendExpired(expiry, expiry + 11)).toBe(false);
    expect(isZcashTransparentSendExpired(expiry, expiry + 30)).toBe(false);
    expect(isZcashTransparentSendExpired(expiry, expiry + 31)).toBe(true);
  });

  it('stays dropped once dropped while the tip crosses NU7', () => {
    const expiry = NU7 - 5;
    const expired: boolean[] = [];
    for (let tip = expiry; tip <= NU7 + 40; tip += 1) {
      expired.push(isZcashTransparentSendExpired(expiry, tip));
    }
    const firstDropped = expired.indexOf(true);
    expect(firstDropped).toBeGreaterThan(0);
    expect(expired.slice(firstDropped).every(Boolean)).toBe(true);
  });
});
