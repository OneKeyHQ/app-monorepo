import { isNil } from 'lodash';

import { convertHistoryTxsFiatCurrency } from '@onekeyhq/shared/src/utils/historyUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type {
  IAccountHistoryTx,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';

// The server cannot see Lightning Self-Custody fees, so every history detail
// reports a fee of 0, and the details page shows the detail's fee before the
// history record's. Report the fee of this device's record of the transaction
// instead: the history merge derives it for sends made from this device.
export function withLocalHistoryFee({
  resp,
  localTx,
  currency,
  currencyMap,
}: {
  resp: IServerFetchAccountHistoryDetailResp;
  localTx: IAccountHistoryTx | undefined;
  // The currency the detail is priced in, and the rates that bring the
  // record's fiat values to it.
  currency?: string;
  currencyMap?: Record<string, ICurrencyItem>;
}): IServerFetchAccountHistoryDetailResp {
  const fee = localTx?.decodedTx.totalFeeInNative;
  if (!localTx || isNil(fee)) {
    return resp;
  }
  // The record keeps the fiat values of the currency it was priced in. Bring
  // them to the detail's currency; without a rate they are dropped rather
  // than shown under another currency's symbol.
  const [record] = convertHistoryTxsFiatCurrency({
    txs: [localTx],
    targetCurrency: currency,
    currencyMap,
    hideUnconvertible: true,
  });
  const detail = resp.data.data;
  return {
    ...resp,
    data: {
      ...resp.data,
      data: {
        ...detail,
        data: {
          ...detail.data,
          gasFee: fee,
          gasFeeFiatValue:
            record.decodedTx.totalFeeFiatValue ?? detail.data.gasFeeFiatValue,
        },
      },
    },
  };
}
