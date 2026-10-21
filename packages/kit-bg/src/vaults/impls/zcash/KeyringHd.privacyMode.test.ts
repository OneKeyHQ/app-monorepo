import { seedFromHdCredentialAsync } from '@onekeyhq/core/src/secret';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

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

  // Only an enable records scan state; a derived or saved account leaves none.
  it('creates transparent accounts without deriving or recording privacy state', async () => {
    const account = {
      id: "hd-1--m/44'/133'/0'/0/0",
      pathIndex: 0,
    };
    const prepareAccounts = jest
      .spyOn(KeyringHdBtc.prototype, 'prepareAccounts')
      .mockResolvedValue([account] as never);
    const privacyChainState = new Proxy(
      {},
      {
        get: (_target, method) => {
          throw new OneKeyLocalError(
            `unexpected privacy state access: ${String(method)}`,
          );
        },
      },
    );
    const keyring = Object.assign(Object.create(KeyringHd.prototype), {
      backgroundApi: { simpleDb: { privacyChainState } },
    }) as KeyringHd;

    await expect(keyring.prepareAccounts({} as never)).resolves.toEqual([
      account,
    ]);

    expect(prepareAccounts).toHaveBeenCalledTimes(1);
    // Account creation never decrypts the seed for Zcash key material.
    expect(seedFromHdCredentialAsync).not.toHaveBeenCalled();
  });
});
