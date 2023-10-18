import { IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import solMockData from '../@tests/solMockData';

import { KeyringHd } from './KeyringHd';

import type { SOLPresetCaseType } from '../@tests/solPresetCase';

jest.setTimeout(3 * 60 * 1000);

const solAccountNameInfo = getAccountNameInfoByImpl(IMPL_SOL);

describe('Solana KeyringHd Tests', () => {
  beforeAll(() => {
    jest.mock('../../../../managers/nft.ts', () => ({}));
  });
  it('solana prepareAccounts with default coinType BIP44', async () => {
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
      {
        accounts: hdAccount1.accounts || [],
        coinType: solAccountNameInfo.default.coinType,
        template: solAccountNameInfo.default.template,
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      },
    );
  });

  it('solana prepareAccounts with ledgerLive coinType', async () => {
    const { testPrepareAccounts } =
      require('../@tests/solPresetCase') as SOLPresetCaseType;
    const { network, hdAccount2 } = solMockData;
    await testPrepareAccounts(
      {
        dbNetwork: network,
        dbAccount: hdAccount2.account,
        mnemonic: hdAccount2.mnemonic,
        password: hdAccount2.password,
      },
      {
        keyring({ vault }) {
          return new KeyringHd(vault);
        },
      },
      {
        accounts: hdAccount2.accounts || [],
        coinType: solAccountNameInfo.ledgerLive.coinType,
        template: solAccountNameInfo.ledgerLive.template,
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      },
    );
  });
});
