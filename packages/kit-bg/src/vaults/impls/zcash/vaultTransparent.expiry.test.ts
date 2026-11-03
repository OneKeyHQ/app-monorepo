import { ZCASH_NU7_ACTIVATION_HEIGHT_MAINNET as NU7 } from '@onekeyhq/shared/src/config/zcash';

import { isZcashTransparentSendExpired } from './vaultTransparent';

jest.mock('../../../dbs/local/localDbInstance');

// The drop margin stands for time (indexer lag), so it triples at NU7 like expiry (ZIP 218).
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
});
