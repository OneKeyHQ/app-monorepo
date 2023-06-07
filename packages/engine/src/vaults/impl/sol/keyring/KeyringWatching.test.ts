import solMockData from '../@tests/solMockData';

import { KeyringWatching } from './KeyringWatching';

import type { SOLPresetCaseType } from '../@tests/solPresetCase';

jest.setTimeout(3 * 60 * 1000);

describe('Solana KeyringWatching Tests', () => {
  beforeAll(() => {
    jest.mock('../../../../managers/nft.ts', () => ({}));
  });
  it('solana prepareAccounts', async () => {
    const { testPrepareAccounts } =
      require('../@tests/solPresetCase') as SOLPresetCaseType;
    const { network, watchingAccount1 } = solMockData;
    await testPrepareAccounts(
      {
        dbNetwork: network,
        dbAccount: watchingAccount1.account,
        privateKey: watchingAccount1.privateKey,
        mnemonic: watchingAccount1.mnemonic,
        password: watchingAccount1.password,
      },
      {
        keyring({ vault }) {
          return new KeyringWatching(vault);
        },
      },
    );
  });
});
