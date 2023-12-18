import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IEstimateGasParams,
  IEstimateGasResp,
  IFeeInfoUnit,
  IGasEIP1559,
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
      '/wallet/v1/onchain/estimate-fee',
      params,
    );
    return resp.data.data;
  }

  @backgroundMethod()
  async fetchFeeInfoUnit(
    params: { presetIndex: number } & IEstimateGasParams,
  ): Promise<IFeeInfoUnit> {
    const { presetIndex, ...restParams } = params;
    const gasFee = await this.estimateGasFee(restParams);

    if (gasFee.fees.length === 5) {
      gasFee.fees = gasFee.fees.slice(1, 4);
    }

    const baseInfo = {
      isEIP1559: gasFee.isEIP1559,
      common: {
        limit: gasFee.limit ?? DEFAULT_GAS_LIMIT,
        limitForDisplay:
          gasFee.limitForDisplay ?? gasFee.limit ?? DEFAULT_GAS_LIMIT,
        feeDecimals: gasFee.feeDecimals,
        feeSymbol: gasFee.feeSymbol,
        nativeDecimals: gasFee.nativeDecimals,
        nativeSymbol: gasFee.nativeSymbol,
      },
    };

    if (baseInfo.isEIP1559) {
      return {
        ...baseInfo,
        gasEIP1559: (gasFee.fees[presetIndex] ?? gasFee.fees[0]) as IGasEIP1559,
      };
    }

    return {
      ...baseInfo,
      gas: {
        gasPrice: (gasFee.fees[presetIndex] ?? gasFee.fees[0]) as string,
        gasLimit: baseInfo.common.limit,
      },
    };
  }
}

export default ServiceGas;
