/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { KeyringHdBase } from '../../base/KeyringHdBase';

import { KeyringHd } from './KeyringHd';

import type Vault from './Vault';
import type { IDBVariantAccount } from '../../../dbs/local/types';
import type { IPrepareHdAccountsParams } from '../../types';

const spendPublicKeyHex = 'aa'.repeat(32);
const viewPrivateKeyHex = 'bb'.repeat(32);

afterEach(() => {
  jest.restoreAllMocks();
});

// The view key reveals every incoming payment; it must not sit on the account
// record, which cloud backup, Prime transfer and account listings carry, and
// a derived account the user never enables must not leave it on disk either.
it('drops the view key from the account record and stores nothing', async () => {
  const saveKey = jest.fn(async () => undefined);
  const keyring = Object.assign(
    Object.create(KeyringHd.prototype) as KeyringHd,
    {
      vault: { networkId: 'xmr--0' } as unknown as Vault,
      backgroundApi: { simpleDb: { privacyChainKeys: { saveKey } } },
    },
  );
  jest
    .spyOn(KeyringHdBase.prototype, 'basePrepareAccountsHd')
    .mockResolvedValue([
      {
        id: 'hd-1--0',
        address: '4synthetic',
        pub: `${spendPublicKeyHex}:${viewPrivateKeyHex}`,
      } as IDBVariantAccount,
    ]);

  const [account] = await keyring.prepareAccounts(
    {} as IPrepareHdAccountsParams,
  );

  expect(account.pub).toBe(spendPublicKeyHex);
  expect(JSON.stringify(account)).not.toContain(viewPrivateKeyHex);
  expect(saveKey).not.toHaveBeenCalled();
});
