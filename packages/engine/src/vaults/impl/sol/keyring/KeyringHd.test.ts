import { constants } from 'fs/promises';

import solMockData from '../@tests/solMockData';

import { KeyringHd } from './KeyringHd';

import type { SOLPresetCaseType } from '../@tests/solPresetCase';

jest.setTimeout(3 * 60 * 1000);

describe('Solana KeyringHd Tests', () => {
  beforeAll(() => {
    jest.mock('../../../../managers/nft.ts', () => ({}));
  });
  it('solana prepareAccounts', async () => {
    const { testPrepareAccounts } =
      require('../@tests/solPresetCase') as SOLPresetCaseType;
    const { network, hdAccount1 } = solMockData;
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

  it('solana signTransaction', async () => {
    const { network, hdAccount1 } = solMockData;
    const { testSignTransaction } =
      require('../@tests/solPresetCase') as SOLPresetCaseType;
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
