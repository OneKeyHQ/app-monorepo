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
    const gasFee = resp.data.data;

    return {
      common: {
        baseFee: gasFee.baseFee,
        feeDecimals: gasFee.feeDecimals,
        feeSymbol: gasFee.feeSymbol,
        nativeDecimals: gasFee.nativeDecimals,
        nativeSymbol: gasFee.nativeSymbol,
        nativeTokenPrice: gasFee.nativeTokenPrice?.price,
      },
      gas: gasFee.gas,
      gasEIP1559: gasFee.gasEIP1559,
      feeUTXO: gasFee.feeUTXO,
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
}

export default ServiceGas;
