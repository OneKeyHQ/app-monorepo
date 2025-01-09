import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

import type { ICoinSelectParams } from '@onekeyfe/coinselect/witness';

export class CoinSelectScene extends BaseScene {
  @LogToLocal()
  public coinSelectFailed(params: ICoinSelectParams, error?: Error) {
    return {
      utxos: params.utxos,
      outputs: params.outputs,
      feeRate: params.feeRate,
      network: params.network,
      changeAddress: params.changeAddress,
      txType: params.txType,
      baseFee: params.baseFee,
      dustThreshold: params.dustThreshold,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
  }
}
