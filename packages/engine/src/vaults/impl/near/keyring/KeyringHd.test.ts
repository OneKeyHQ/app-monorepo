import nearMockData from '../@tests/nearMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/nearPresetCase';

import { KeyringHd } from './KeyringHd';

jest.setTimeout(3 * 60 * 1000);

describe('Near KeyringHd Tests', () => {
  it('near hd sign tx', async () => {
    const { network, hdAccount1 } = nearMockData;
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

  it('near prepareAccounts', async () => {
    const { network, hdAccount1 } = nearMockData;
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
});

export {};
