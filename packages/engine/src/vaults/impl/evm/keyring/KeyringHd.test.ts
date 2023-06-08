import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import { hdAccount1, hdAccount2, network } from '../@tests/evmMockData';

import { KeyringHd } from './KeyringHd';

import type { EVMPresetCaseType } from '../@tests/evmPresetCase';

const evmAccountNameInfo = getAccountNameInfoByImpl(IMPL_EVM);

jest.setTimeout(3 * 60 * 1000);

describe('EVM KeyringHd Tests', () => {
  beforeAll(() => {
    jest.mock('../../../../managers/nft.ts', () => ({
      buildEncodeDataWithABI: jest.fn(),
      createOutputActionFromNFTTransaction: jest.fn(),
      getAsset: jest.fn(),
      getNFTTransactionHistory: jest.fn(),
    }));
    jest.mock('../../../../managers/covalent.ts', () => ({
      fetchCovalentHistoryRaw: jest.fn(),
      getTxHistories: jest.fn(),
      getErc20TransferHistories: jest.fn(),
      getNftDetail: jest.fn(),
    }));
  });

  it('evm prepareAccounts with default coinType', async () => {
    const { testPrepareAccounts } =
      require('../@tests/evmPresetCase') as EVMPresetCaseType;
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
        coinType: evmAccountNameInfo.default.coinType,
        template: evmAccountNameInfo.default.template,
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      },
    );
  });

  it('evm prepareAccounts with ledgerLive coinType', async () => {
    const { testPrepareAccounts } =
      require('../@tests/evmPresetCase') as EVMPresetCaseType;
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
        coinType: evmAccountNameInfo.ledgerLive.coinType,
        template: evmAccountNameInfo.ledgerLive.template,
        indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      },
    );
  });
});

export {};
