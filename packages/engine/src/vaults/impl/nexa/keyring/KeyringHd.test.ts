import nexaMockData from '../@tests/nexaMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/nexaPresetCase';

import { KeyringHd } from './KeyringHd';

jest.setTimeout(3 * 60 * 1000);

describe('Nexa KeyringHd Tests', () => {
  it('Nexa KeyringHd prepareAccounts', async () => {
    const { network, hdAccount1 } = nexaMockData;
    await testPrepareAccounts(
      {
        dbNetwork: network,
        dbAccount: hdAccount1.account,
        mnemonic: hdAccount1.mnemonic,
        password: hdAccount1.password,
      },
      {
        keyring({ vault }) {
          return new KeyringHd(vault);
        },
      },
    );
  });

  it('Nexa KeyringHd sign tx', async () => {
    const { network, hdAccount1 } = nexaMockData;
    await testSignTransaction(
      {
        dbNetwork: network,
        dbAccount: hdAccount1.account,
        mnemonic: hdAccount1.mnemonic,
        password: hdAccount1.password,
      },
      {
        keyring({ vault }) {
          return new KeyringHd(vault);
        },
      },
    );
  });
});

export {};
