/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ZcashPrivacyMode } from './privacyMode';
import Vault from './Vault';

// Watch-only accounts have no viewing key: the private tab says 'not supported', receive still gets the transparent address.
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
          getDBAccountSafe: async () => ({ address: 't1watched' }),
        },
      },
    });
  }

  it.each([
    ["hd-1--m/44'/133'/0'", true],
    ['watching--133--t1watched', false],
  ])('%s supports privacy: %s', (accountId, supported) => {
    const vault = createVault(jest.fn());
    expect(vault.supportsAccountWalletType({ accountId })).toBe(supported);
  });

  it('gives a watch-only account its transparent address without asking for privacy data', async () => {
    const getMeta = jest.fn(async () => {
      throw new OneKeyLocalError(
        'zcash: privacy mode requires an HD or hardware account',
      );
    });
    const vault = createVault(getMeta);
    const capability = vault.getLocalWalletCapability();

    await expect(
      capability?.getAccountAddresses({
        accountId: 'watching--133--t1watched',
      }),
    ).resolves.toEqual({
      publicAddress: 't1watched',
      privateAddress: undefined,
    });
    expect(getMeta).not.toHaveBeenCalled();
  });

  it.each([
    ["hw-1--m/44'/133'/0'", 'u1-mixed', 'u1-orchard', 'u1-mixed'],
    ["hw-1--m/44'/133'/0'", 'u1-orchard', undefined, 'u1-orchard'],
    ["hd-1--m/44'/133'/0'", 'u1-software', undefined, 'u1-software'],
  ] as const)(
    'preserves the receive address selected from account metadata for %s (%s)',
    async (
      accountId,
      unifiedAddress,
      derivedUnifiedAddress,
      expectedAddress,
    ) => {
      const meta = Object.freeze({
        transparentAddress: 't1-account',
        unifiedAddress,
        derivedUnifiedAddress,
      });
      const vault = createVault(jest.fn(async () => meta));

      await expect(
        vault.getLocalWalletCapability()?.getAccountAddresses({ accountId }),
      ).resolves.toEqual({
        publicAddress: 't1-account',
        privateAddress: expectedAddress,
      });
    },
  );
});
