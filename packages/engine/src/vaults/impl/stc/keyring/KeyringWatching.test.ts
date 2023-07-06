import {
  network,
  watchingAccount1,
  watchingAccount2,
} from '../@tests/stcMockData';
import { testPrepareAccounts } from '../@tests/stcPresetCase';

import { KeyringWatching } from './KeyringWatching';

jest.setTimeout(3 * 60 * 1000);

describe('Starcoin KeyringWatching Tests', () => {
  it('Starcoin prepareAccounts', async () => {
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
  });
});

export {};
