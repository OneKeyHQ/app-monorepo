import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
  IServerFetchAccountHistoryDetailParams,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';

import {
  currencyPersistAtom,
  settingsPersistAtom,
} from '../../../states/jotai/atoms';
import { VaultBase } from '../../base/VaultBase';

import SparkVault from './Vault';

const currencyMap = {
  usd: { id: 'usd', unit: '$', name: 'USD', type: [], value: '1' },
  cny: { id: 'cny', unit: '¥', name: 'CNY', type: [], value: '7' },
} as unknown as Record<string, ICurrencyItem>;

function detailResp(): IServerFetchAccountHistoryDetailResp {
  return {
    data: {
      data: {
        data: {
          tx: 'payment-id',
          gasFee: '0',
          gasFeeFiatValue: '0',
        } as IOnChainHistoryTx,
        tokens: {},
        nfts: {},
      },
    },
  };
}

// This device's record of the send, priced in USD.
const localTx = {
  id: 'history-id',
  fiatCurrency: 'usd',
  decodedTx: {
    txid: 'payment-id',
    totalFeeInNative: '2',
    totalFeeFiatValue: '0.0014',
    actions: [] as IAccountHistoryTx['decodedTx']['actions'],
  },
} as IAccountHistoryTx;

describe('Spark Vault.fetchAccountHistoryDetail', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prices the detail and the fee in the currency set when the request started', async () => {
    let currency = 'usd';
    jest
      .spyOn(settingsPersistAtom, 'get')
      .mockImplementation(
        async () => ({ currencyInfo: { id: currency } }) as never,
      );
    jest
      .spyOn(currencyPersistAtom, 'get')
      .mockResolvedValue({ currencyMap } as never);
    const fetchDetail = jest
      .spyOn(VaultBase.prototype, 'fetchAccountHistoryDetail')
      .mockImplementation(async () => {
        // The user switches the currency while the request runs.
        currency = 'cny';
        return detailResp();
      });
    const vault = Object.assign(Object.create(SparkVault.prototype), {
      backgroundApi: {
        simpleDb: {
          localHistory: { getLocalHistoryTxById: async () => localTx },
        },
      },
    }) as SparkVault;

    const resp = await vault.fetchAccountHistoryDetail({
      networkId: 'lightningspark--0',
      txid: 'payment-id',
      accountAddress: 'spark address',
    } as IServerFetchAccountHistoryDetailParams);

    expect(fetchDetail).toHaveBeenCalledWith(
      expect.objectContaining({ requestCurrency: 'usd' }),
    );
    // The record is already in USD, so its fee fiat value is kept as is.
    expect(resp.data.data.data).toMatchObject({
      gasFee: '2',
      gasFeeFiatValue: '0.0014',
    });
  });
});
