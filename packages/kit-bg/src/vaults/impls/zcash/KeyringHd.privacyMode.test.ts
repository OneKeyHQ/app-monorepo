import { KeyringHd as KeyringHdBtc } from '../btc/KeyringHd';

import { KeyringHd } from './KeyringHd';

jest.mock('@onekeyhq/core/src/instance/coreChainApi', () => ({
  __esModule: true,
  default: { zec: { hd: {} } },
}));
jest.mock('@onekeyhq/core/src/secret', () => ({
  seedFromHdCredentialAsync: jest.fn(),
}));
jest.mock('../btc/KeyringHd', () => ({
  KeyringHd: class {
    prepareAccounts() {
      return Promise.resolve([]);
    }
  },
}));

describe('Zcash KeyringHd privacy mode setup', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates transparent accounts without deriving shielded metadata', async () => {
    const account = {
      id: "hd-1--m/44'/133'/0'/0/0",
      pathIndex: 0,
    };
    const prepareAccounts = jest
      .spyOn(KeyringHdBtc.prototype, 'prepareAccounts')
      .mockResolvedValue([account] as never);
    const initializePrivacyModeOff = jest.fn().mockResolvedValue(undefined);
    const getWalletFreshMnemonic = jest.fn().mockResolvedValue(true);
    const getWalletCreatedAtTimestamp = jest
      .fn()
      .mockResolvedValue(1_700_000_000_000);
    const keyring = Object.assign(Object.create(KeyringHd.prototype), {
      backgroundApi: {
        simpleDb: {
          zcash: {
            getWalletFreshMnemonic,
            getWalletCreatedAtTimestamp,
            initializePrivacyModeOff,
          },
        },
      },
    }) as KeyringHd;

    await expect(keyring.prepareAccounts({} as never)).resolves.toEqual([
      account,
    ]);

    expect(prepareAccounts).toHaveBeenCalledTimes(1);
    expect(getWalletFreshMnemonic).toHaveBeenCalledWith({ walletId: 'hd-1' });
    expect(initializePrivacyModeOff).toHaveBeenCalledWith({
      accountId: account.id,
      birthdayMonthHint: {
        timestamp: 1_700_000_000_000,
        source: 'created-wallet',
      },
    });
  });

  it('does not substitute the later account creation time for a missing wallet creation month', async () => {
    const account = {
      id: "hd-2--m/44'/133'/0'/0/0",
      pathIndex: 0,
    };
    jest
      .spyOn(KeyringHdBtc.prototype, 'prepareAccounts')
      .mockResolvedValue([account] as never);
    const initializePrivacyModeOff = jest.fn().mockResolvedValue(undefined);
    const keyring = Object.assign(Object.create(KeyringHd.prototype), {
      backgroundApi: {
        simpleDb: {
          zcash: {
            getWalletFreshMnemonic: jest.fn().mockResolvedValue(true),
            getWalletCreatedAtTimestamp: jest.fn().mockResolvedValue(undefined),
            initializePrivacyModeOff,
          },
        },
      },
    }) as KeyringHd;

    await keyring.prepareAccounts({} as never);

    expect(initializePrivacyModeOff).toHaveBeenCalledWith({
      accountId: account.id,
      birthdayMonthHint: undefined,
    });
  });
});
