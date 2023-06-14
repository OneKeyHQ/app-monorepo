import cfxMockData from '../@tests/cfxMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/cfxPresetCase';

import { KeyringHd } from './KeyringHd';

jest.setTimeout(3 * 60 * 1000);

describe('Conflux KeyringHd Tests', () => {
  it('conflux prepareAccounts', async () => {
    const { network, hdAccount1 } = cfxMockData;
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

  it('conflux signTransaction', async () => {
    const { network, hdAccount1 } = cfxMockData;
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
