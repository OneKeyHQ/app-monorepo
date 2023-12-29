import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IEstimateGasParams,
  IEstimateGasResp,
} from '@onekeyhq/shared/types/gas';

import ServiceBase from './ServiceBase';

const DEFAULT_GAS_LIMIT = '21000';

@backgroundClass()
class ServiceGas extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async estimateGasFee(params: IEstimateGasParams) {
    const client = await this.getClient();
    const resp = await client.post<{ data: IEstimateGasResp }>(
      '/wallet/v1/account/estimate-fee',
      params,
    );
    const gasFee = resp.data.data;

    return {
      common: {
        baseFeeValue: gasFee.baseFeeValue,
        limit: gasFee.limit ?? DEFAULT_GAS_LIMIT,
        limitForDisplay:
          gasFee.limitForDisplay ?? gasFee.limit ?? DEFAULT_GAS_LIMIT,
        feeDecimals: gasFee.feeDecimals,
        feeSymbol: gasFee.feeSymbol,
        nativeDecimals: gasFee.nativeDecimals,
        nativeSymbol: gasFee.nativeSymbol,
      },
      gas: gasFee.gas,
      gasEIP1559: gasFee.gasEIP1559,
      feeUTXO: gasFee.gasUTXO,
      nativeTokenPrice: gasFee.nativeTokenPrice,
      prediction: gasFee.prediction,
    };
  }
}

export default ServiceGas;
