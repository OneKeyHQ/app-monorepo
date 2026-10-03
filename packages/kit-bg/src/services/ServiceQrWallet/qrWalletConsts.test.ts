import { WALLET_CONNECT_CLIENT_NAME } from '@onekeyhq/shared/src/walletConnect/constant';

import { UR_DEFAULT_ORIGIN } from './qrWalletConsts';

describe('qrWalletConsts', () => {
  it('preserves the platform origin for existing QR wallets', () => {
    expect(UR_DEFAULT_ORIGIN).toBe(WALLET_CONNECT_CLIENT_NAME);
  });
});
