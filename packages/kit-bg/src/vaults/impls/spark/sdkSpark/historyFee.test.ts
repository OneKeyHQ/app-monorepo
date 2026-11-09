import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';

import { withLocalHistoryFee } from './historyFee';

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

function localTx(
  totalFeeInNative?: string,
  totalFeeFiatValue?: string,
): IAccountHistoryTx {
  return {
    id: 'history-id',
    decodedTx: { txid: 'payment-id', totalFeeInNative, totalFeeFiatValue },
  } as IAccountHistoryTx;
}

describe('withLocalHistoryFee', () => {
  it("reports the fee of this device's history record", () => {
    const resp = withLocalHistoryFee({
      resp: detailResp(),
      localTx: localTx('2', '0.0014'),
    });

    expect(resp.data.data.data.gasFee).toBe('2');
    expect(resp.data.data.data.gasFeeFiatValue).toBe('0.0014');
    expect(resp.data.data.data.tx).toBe('payment-id');
  });

  it('keeps the detail fiat value when the record has none', () => {
    const resp = withLocalHistoryFee({
      resp: detailResp(),
      localTx: localTx('2'),
    });

    expect(resp.data.data.data.gasFee).toBe('2');
    expect(resp.data.data.data.gasFeeFiatValue).toBe('0');
  });

  it.each([
    ['no history record', undefined],
    ['a record without a fee', localTx()],
  ])('returns the detail unchanged for %s', (_name, record) => {
    const original = detailResp();

    expect(withLocalHistoryFee({ resp: original, localTx: record })).toBe(
      original,
    );
  });
});
