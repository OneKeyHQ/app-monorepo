import stacksMockData from '../@tests/stacksMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/stacksPresetCase';

import { KeyringHd } from './KeyringHd';

jest.setTimeout(3 * 60 * 1000);

describe('Stacks KeyringHd Tests', () => {
  it('Stacks KeyringHd prepareAccounts', async () => {
    const { network, hdAccount1 } = stacksMockData;
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

  it('Stacks KeyringHd sign tx', async () => {
    const { network, hdAccount1 } = stacksMockData;
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
