import nexaMockData from '../@tests/nexaMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/nexaPresetCase';

import { KeyringImported } from './KeyringImported';

jest.setTimeout(3 * 60 * 1000);

describe('Nexa KeyringImported Tests', () => {
  it('Nexa KeyringImported prepareAccounts', async () => {
    const { network, importedAccount1 } = nexaMockData;
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

  it('Nexa KeyringImported sign tx', async () => {
    const { network, importedAccount2 } = nexaMockData;
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
