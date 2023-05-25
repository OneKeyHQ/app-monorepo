import nearMockData from '../@tests/nearMockData';
import nearPresetCase from '../@tests/nearPresetCase';

import { KeyringImported } from './KeyringImported';

jest.setTimeout(3 * 60 * 1000);

describe('Near KeyringImported Tests', () => {
  it('near imported sign tx', async () => {
    const { network, importedAccount1 } = nearMockData;
    await nearPresetCase.testSignTransaction(
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
});

export {};
