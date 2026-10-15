/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ZcashPrivacyMode } from './privacyMode';
import Vault from './Vault';

// Imported and watch-only accounts send and watch transparent funds but have
// no viewing key: the private tab must say "not supported", and the receive
// page must still get the transparent address without a privacy error.
describe('zcash privacy support by wallet type', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createVault(getLocalWalletAccountMeta: jest.Mock) {
    jest
      .spyOn(ZcashPrivacyMode.prototype, 'getLocalWalletAccountMeta')
      .mockImplementation(getLocalWalletAccountMeta);
    return Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        serviceAccount: {
          getDBAccountSafe: async () => ({ address: 't1imported' }),
        },
      },
    });
  }

  it.each([
    ["hd-1--m/44'/133'/0'", true],
    ['imported--133--t1imported', false],
    ['watching--133--t1watched', false],
  ])('%s supports privacy: %s', (accountId, supported) => {
    const vault = createVault(jest.fn());
    expect(vault.supportsAccountWalletType({ accountId })).toBe(supported);
  });

  it('gives an imported account its transparent address without asking for privacy data', async () => {
    const getMeta = jest.fn(async () => {
      throw new OneKeyLocalError(
        'zcash: privacy mode requires an HD or hardware account',
      );
    });
    const vault = createVault(getMeta);
    const capability = vault.getLocalWalletCapability();

    await expect(
      capability?.getAccountAddresses({
        accountId: 'imported--133--t1imported',
      }),
    ).resolves.toEqual({
      publicAddress: 't1imported',
      privateAddress: undefined,
    });
    expect(getMeta).not.toHaveBeenCalled();
  });
});
