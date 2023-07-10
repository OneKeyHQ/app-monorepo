import {
  importedAccount1,
  importedAccount2,
  network,
} from '../@tests/stcMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/stcPresetCase';

import { KeyringImported } from './KeyringImported';

jest.setTimeout(3 * 60 * 1000);

describe('Starcoin KeyringImported Tests', () => {
  it('Starcoin prepareAccounts', async () => {
    await testPrepareAccounts(
      {
        dbNetwork: network,
        dbAccount: importedAccount1.account,
        privateKey: importedAccount1.privateKey,
        password: importedAccount1.password,
      },
      {
        keyring({ vault }) {
          return new KeyringImported(vault);
        },
      },
    );
  });

  it('Starcoin signTransaction', async () => {
    await testSignTransaction(
      {
        dbNetwork: network,
        dbAccount: importedAccount2.account,
        privateKey: importedAccount2.privateKey,
        password: importedAccount2.password,
      },
      {
        keyring({ vault }) {
          return new KeyringImported(vault);
        },
      },
    );
  });
});

export {};
