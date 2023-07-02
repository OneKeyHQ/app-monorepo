import nexaMockData from '../@tests/nexaMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/nexaPresetCase';

import { KeyringImported } from './KeyringImported';

jest.setTimeout(3 * 60 * 1000);

describe('Nexa KeyringImported Tests', () => {
  it('Nexa prepareAccounts', async () => {
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

  // it('Nexa hd sign tx', async () => {
  //   const { network, hdAccount1 } = nexaMockData;
  //   await testSignTransaction(
  //     {
  //       dbNetwork: network,
  //       dbAccount: hdAccount1.account,
  //       mnemonic: hdAccount1.mnemonic,
  //       password: hdAccount1.password,
  //     },
  //     {
  //       keyring({ vault }) {
  //         return new KeyringHd(vault);
  //       },
  //     },
  //   );
  // });
});

export {};
