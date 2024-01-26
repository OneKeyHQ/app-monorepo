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

    const limitInfo = {
      gasLimit: gasFee.limit ?? DEFAULT_GAS_LIMIT,
      gasLimitForDisplay:
        gasFee.limitForDisplay ?? gasFee.limit ?? DEFAULT_GAS_LIMIT,
    };

    return {
      common: {
        baseFeeValue: gasFee.baseFeeValue,
        feeDecimals: gasFee.feeDecimals,
        feeSymbol: gasFee.feeSymbol,
        nativeDecimals: gasFee.nativeDecimals,
        nativeSymbol: gasFee.nativeSymbol,
        nativeTokenPrice: gasFee.nativeTokenPrice.price,
      },
      gas: gasFee.gas?.map((item) => ({
        ...item,
        ...limitInfo,
      })),
      gasEIP1559: gasFee.gasEIP1559?.map((item) => ({
        ...item,
        ...limitInfo,
      })),
      feeUTXO: gasFee.feeUTXO,
      prediction: gasFee.prediction,
    };
  }
}

export default ServiceGas;
