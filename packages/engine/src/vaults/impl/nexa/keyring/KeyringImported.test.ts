import nexaMockData from '../@tests/nexaMockData';
import { testPrepareAccounts } from '../@tests/nexaPresetCase';

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
});

export {};
