import solMockData from '../@tests/solMockData';

import { KeyringImported } from './KeyringImported';

import type { SOLPresetCaseType } from '../@tests/solPresetCase';

jest.setTimeout(3 * 60 * 1000);

describe('Solana KeyringImported Tests', () => {
  beforeAll(() => {
    jest.mock('../../../../managers/nft.ts', () => ({}));
  });
  it('solana prepareAccounts', async () => {
    const { testPrepareAccounts } =
      require('../@tests/solPresetCase') as SOLPresetCaseType;
    const { network, importedAccount1 } = solMockData;
    await testPrepareAccounts(
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

  it('solana signTransaction', async () => {
    const { network, importedAccount2 } = solMockData;
    const { testSignTransaction } =
      require('../@tests/solPresetCase') as SOLPresetCaseType;
    await testSignTransaction(
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
