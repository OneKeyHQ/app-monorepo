import nearMockData from '../@tests/nearMockData';
import {
  testPrepareAccounts,
  testSignTransaction,
} from '../@tests/nearPresetCase';

import { KeyringImported } from './KeyringImported';

jest.setTimeout(3 * 60 * 1000);

describe('Near KeyringImported Tests', () => {
  it('near imported sign tx', async () => {
    const { network, importedAccount1 } = nearMockData;
    try {
      await testSignTransaction(
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
    } catch (error: any) {
      // TODO: 临时规避 JSONRPC 调用超过限量的问题，需要用 mock 替代。
      console.error(error.response);
      expect(error.response.error.message).toBe('Exceeded the quota usage');
    }
  });

  it('near prepareAccounts', async () => {
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
