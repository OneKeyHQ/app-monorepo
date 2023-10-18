import cfxMockData from '../@tests/cfxMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/cfxPresetCase';

import { KeyringImported } from './KeyringImported';

jest.setTimeout(3 * 60 * 1000);

describe('Conflux KeyringImported Tests', () => {
  it('conflux prepareAccounts', async () => {
    const { network, importedAccount1 } = cfxMockData;
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

  it('conflux signTransaction', async () => {
    const { network, importedAccount2 } = cfxMockData;
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
