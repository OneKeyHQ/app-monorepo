import nearMockData from '../@tests/nearMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/nearPresetCase';

import { KeyringImported } from './KeyringImported';

jest.setTimeout(3 * 60 * 1000);

describe('Near KeyringImported Tests', () => {
  it('near imported sign tx', async () => {
    const { network, importedAccount1 } = nearMockData;
    await testSignTransaction(
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

  it('near prepareAccounts', async () => {
    const { network, importedAccount2 } = nearMockData;
    await testPrepareAccounts(
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
