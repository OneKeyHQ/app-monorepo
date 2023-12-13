import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IEIP1559Fee,
  IEstimateGasParams,
  IEstimateGasResp,
  IFeeInfoUnit,
} from '@onekeyhq/shared/types/gas';

import { getBaseEndpoint } from '../endpoints';

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
    const baseEndpoint = await getBaseEndpoint();
    const resp = await client.post<{ data: IEstimateGasResp }>(
      `${baseEndpoint}/v5/onchain/estimate-fee`,
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
      limit: gasFee.limit ?? DEFAULT_GAS_LIMIT,
      limitForDisplay:
        gasFee.limitForDisplay ?? gasFee.limit ?? DEFAULT_GAS_LIMIT,
      feeDecimals: gasFee.feeDecimals,
      feeSymbol: gasFee.feeSymbol,
      nativeDecimals: gasFee.nativeDecimals,
      nativeSymbol: gasFee.nativeSymbol,
    };

    if (baseInfo.isEIP1559) {
      return {
        ...baseInfo,
        price1559: (gasFee.fees[presetIndex] ?? gasFee.fees[0]) as IEIP1559Fee,
      };
    }

    return {
      ...baseInfo,
      price: (gasFee.fees[presetIndex] ?? gasFee.fees[0]) as string,
    };
  }
}

export default ServiceGas;
