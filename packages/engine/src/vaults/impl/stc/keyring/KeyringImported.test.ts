import { importedAccount1, network } from '../@tests/stcMockData';
import { testPrepareAccounts } from '../@tests/stcPresetCase';

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
});

export {};
