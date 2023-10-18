import { hdAccount1, network } from '../@tests/stcMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/stcPresetCase';

import { KeyringHd } from './KeyringHd';

jest.setTimeout(3 * 60 * 1000);

describe('Starcoin KeyringHd Tests', () => {
  it('Starcoin prepareAccounts', async () => {
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

  it('Starcoin signTransaction', async () => {
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
