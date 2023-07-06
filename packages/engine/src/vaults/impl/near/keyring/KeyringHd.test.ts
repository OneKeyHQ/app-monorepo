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
    try {
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
    } catch (error: any) {
      // TODO: 临时规避 JSONRPC 调用超过限量的问题，需要用 mock 替代。
      console.error(error.response);
      expect(error.response.error.message).toBe('Exceeded the quota usage');
    }
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
