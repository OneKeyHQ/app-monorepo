import nearMockData from '../@tests/cfxMockData';
import { testPrepareAccounts } from '../@tests/cfxPresetCase';

import { KeyringImported } from './KeyringImported';

jest.setTimeout(3 * 60 * 1000);

describe('Conflux KeyringImported Tests', () => {
  it('conflux prepareAccounts', async () => {
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
