import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
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
    decodedTx: {
      txid: 'payment-id',
      totalFeeInNative,
      totalFeeFiatValue,
      actions: [] as IAccountHistoryTx['decodedTx']['actions'],
    },
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

  const currencyMap = {
    usd: { id: 'usd', unit: '$', name: 'USD', type: [], value: '1' },
    cny: { id: 'cny', unit: '¥', name: 'CNY', type: [], value: '7' },
  } as unknown as Record<string, ICurrencyItem>;

  it('brings the fee fiat value to the currency of the detail', () => {
    const resp = withLocalHistoryFee({
      resp: detailResp(),
      localTx: { ...localTx('2', '0.0014'), fiatCurrency: 'usd' },
      currency: 'cny',
      currencyMap,
    });

    expect(resp.data.data.data.gasFee).toBe('2');
    expect(resp.data.data.data.gasFeeFiatValue).toBe('0.0098');
  });

  it('shows no fee fiat value of another currency when a rate is missing', () => {
    const resp = withLocalHistoryFee({
      resp: detailResp(),
      localTx: { ...localTx('2', '0.0014'), fiatCurrency: 'usd' },
      currency: 'eur',
      currencyMap,
    });

    expect(resp.data.data.data.gasFee).toBe('2');
    // The detail's own value, which is in its currency.
    expect(resp.data.data.data.gasFeeFiatValue).toBe('0');
  });
});
