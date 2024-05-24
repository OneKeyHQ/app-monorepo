import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IEstimateGasParams,
  IEstimateGasResp,
} from '@onekeyhq/shared/types/fee';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceGas extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async estimateFee(params: IEstimateGasParams) {
    const client = await this.getClient();

    const resp = await client.post<{ data: IEstimateGasResp }>(
      '/wallet/v1/account/estimate-fee',
      params,
    );
    const feeInfo = resp.data.data;
    return {
      common: {
        baseFee: feeInfo.baseFee,
        feeDecimals: feeInfo.feeDecimals,
        feeSymbol: feeInfo.feeSymbol,
        nativeDecimals: feeInfo.nativeDecimals,
        nativeSymbol: feeInfo.nativeSymbol,
        nativeTokenPrice: feeInfo.nativeTokenPrice?.price,
      },
      gas: feeInfo.gas,
      gasEIP1559: feeInfo.gasEIP1559,
      feeUTXO: feeInfo.feeUTXO,
      feeTron: feeInfo.feeTron,
      gasFil: feeInfo.gasFil,
    };
  }

  @backgroundMethod()
  async buildEstimateFeeParams(params: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTx | undefined;
  }) {
    const { networkId, accountId, encodedTx } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.buildEstimateFeeParams({ encodedTx });
  }

  @backgroundMethod()
  async getFeePresetIndex({ networkId }: { networkId: string }) {
    return this.backgroundApi.simpleDb.feeInfo.getPresetIndex({
      networkId,
    });
  }

  @backgroundMethod()
  async updateFeePresetIndex({
    networkId,
    presetIndex,
  }: {
    networkId: string;
    presetIndex: number;
  }) {
    return this.backgroundApi.simpleDb.feeInfo.updatePresetIndex({
      networkId,
      presetIndex,
    });
  }
}

export default ServiceGas;
