import cfxMockData from '../@tests/cfxMockData';
import { testPrepareAccounts } from '../@tests/cfxPresetCase';

import { KeyringWatching } from './KeyringWatching';

jest.setTimeout(3 * 60 * 1000);

describe('Conflux KeyringWatching Tests', () => {
  it('conflux prepareAccounts', async () => {
    const { network, watchingAccount1 } = cfxMockData;
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
  });
});

export {};
