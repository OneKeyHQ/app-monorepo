import nearMockData from '../@tests/nearMockData';
import { testPrepareAccounts } from '../@tests/nearPresetCase';

import { KeyringWatching } from './KeyringWatching';

jest.setTimeout(3 * 60 * 1000);

describe('Near KeyringImported Tests', () => {
  it('near prepareAccounts', async () => {
    const { network, watchingAccount1, watchingAccount2, watchingAccount3 } =
      nearMockData;
    await testPrepareAccounts(
      {
        dbNetwork: network,
        dbAccount: watchingAccount1.account,
        privateKey: watchingAccount1.privateKey,
        password: watchingAccount1.password,
        accountIdPrefix: 'external',
      },
      {
        keyring({ vault }) {
          return new KeyringWatching(vault);
        },
      },
    );

    await testPrepareAccounts(
      {
        dbNetwork: network,
        dbAccount: watchingAccount2.account,
        privateKey: watchingAccount2.privateKey,
        password: watchingAccount2.password,
        accountIdPrefix: 'external',
      },
      {
        keyring({ vault }) {
          return new KeyringWatching(vault);
        },
      },
    );

    await testPrepareAccounts(
      {
        dbNetwork: network,
        dbAccount: watchingAccount3.account,
        privateKey: watchingAccount3.privateKey,
        password: watchingAccount3.password,
        accountIdPrefix: 'external',
      },
      {
        keyring({ vault }) {
          return new KeyringWatching(vault);
        },
      },
    );

    try {
      await testPrepareAccounts(
        {
          dbNetwork: network,
          dbAccount: {
            ...watchingAccount3.account,
            address: '&^%$#891',
          },
        },
        {
          keyring({ vault }) {
            return new KeyringWatching(vault);
          },
        },
      );
    } catch (error: any) {
      expect(error.message).toBe('InvalidAddress.');
    }
  });
});

export {};
