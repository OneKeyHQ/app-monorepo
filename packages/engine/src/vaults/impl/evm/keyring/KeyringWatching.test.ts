import { network, watchingAccount1 } from '../@tests/evmMockData';

import { KeyringWatching } from './KeyringWatching';

import type { EVMPresetCaseType } from '../@tests/evmPresetCase';

jest.setTimeout(3 * 60 * 1000);

describe('EVM KeyringImported Tests', () => {
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
