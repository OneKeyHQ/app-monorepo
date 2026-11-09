import { isNil } from 'lodash';

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
}: {
  resp: IServerFetchAccountHistoryDetailResp;
  localTx: IAccountHistoryTx | undefined;
}): IServerFetchAccountHistoryDetailResp {
  const fee = localTx?.decodedTx.totalFeeInNative;
  if (!localTx || isNil(fee)) {
    return resp;
  }
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
            localTx.decodedTx.totalFeeFiatValue ?? detail.data.gasFeeFiatValue,
        },
      },
    },
  };
}
