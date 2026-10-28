/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const mockGetVault = jest.fn();
const mockQuoteTokenDetails = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: (...args: unknown[]) => mockGetVault(...args),
    getChainOnlyVault: async () => ({
      fetchTokenDetailsByApi: mockQuoteTokenDetails,
    }),
  },
}));

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

const ServiceHistory = require('./ServiceHistory')
  .default as typeof import('./ServiceHistory').default;

const ownAddress = 'synthetic-own-private-address';

function localRow(networkId: string): IAccountHistoryTx {
  return {
    id: `${networkId}_row`,
    decodedTx: {
      txid: 'row',
      owner: ownAddress,
      signer: ownAddress,
      nonce: 0,
      networkId,
      accountId: 'hd-1',
      status: EDecodedTxStatus.Confirmed,
      extraInfo: null,
      totalFeeInNative: '0.01',
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: ownAddress,
            to: '',
            sends: [
              {
                from: ownAddress,
                to: '',
                amount: '2',
                icon: '',
                name: '',
                symbol: '',
                tokenIdOnNetwork: '',
                isNative: true,
              },
            ],
            receives: [],
          },
        },
      ],
    },
  };
}

function createService() {
  return Object.assign(
    Object.create(ServiceHistory.prototype) as InstanceType<
      typeof ServiceHistory
    >,
    {
      backgroundApi: {
        serviceNetwork: { isCustomNetwork: async () => false },
        serviceToken: { getNativeTokenAddress: async () => '' },
      },
    },
  );
}

describe('ServiceHistory local wallet rows', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prices Monero rows from the address-free network quote', async () => {
    mockGetVault.mockResolvedValue({
      fetchAccountHistoryFromLocal: async () => [localRow('xmr--0')],
    });
    mockQuoteTokenDetails.mockResolvedValue({
      data: { data: [{ info: { address: '' }, price: '150' }] },
    });
    const service = createService();
    const { txs } = await service.fetchAccountOnChainHistory({
      accountId: 'hd-1',
      networkId: 'xmr--0',
      accountAddress: ownAddress,
      sourceCurrency: 'usd',
    });
    expect(txs[0].decodedTx.actions[0].assetTransfer?.sends[0].price).toBe(
      '150',
    );
    expect(txs[0].decodedTx.totalFeeFiatValue).toBe('1.5');
    expect(mockQuoteTokenDetails.mock.calls).toEqual([
      [{ networkId: 'xmr--0', contractList: [''], requestCurrency: 'usd' }],
    ]);
  });

  it('prices shielded Zcash rows in the history currency', async () => {
    mockGetVault.mockResolvedValue({
      fetchAccountHistoryFromLocal: async () => [localRow('zec--0')],
    });
    mockQuoteTokenDetails.mockResolvedValue({
      data: { data: [{ info: { address: '' }, price: 290 }] },
    });
    const service = createService();
    const { txs } = await service.fetchAccountOnChainHistory({
      accountId: 'hd-1',
      networkId: 'zec--0',
      accountAddress: ownAddress,
      sourceCurrency: 'cny',
    });
    expect(txs[0].decodedTx.actions[0].assetTransfer?.sends[0].price).toBe(
      '290',
    );
    expect(mockQuoteTokenDetails.mock.calls).toEqual([
      [{ networkId: 'zec--0', contractList: [''], requestCurrency: 'cny' }],
    ]);
  });

  it('asks for no quote when every row is already priced', async () => {
    const row = localRow('zec--0');
    const send = row.decodedTx.actions[0].assetTransfer?.sends[0];
    if (send) send.price = '280';
    row.decodedTx.totalFeeFiatValue = '2.8';
    mockGetVault.mockResolvedValue({
      fetchAccountHistoryFromLocal: async () => [row],
    });
    const service = createService();
    const { txs } = await service.fetchAccountOnChainHistory({
      accountId: 'hd-1',
      networkId: 'zec--0',
      accountAddress: ownAddress,
    });
    expect(txs[0]).toBe(row);
    expect(mockQuoteTokenDetails).not.toHaveBeenCalled();
  });
});
