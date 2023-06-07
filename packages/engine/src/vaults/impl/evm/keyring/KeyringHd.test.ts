import { hdAccount1, network } from '../@tests/evmMockData';

import { KeyringHd } from './KeyringHd';

import type { EVMPresetCaseType } from '../@tests/evmPresetCase';

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

  it('evm prepareAccounts', async () => {
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
    );
  });
});

export {};
