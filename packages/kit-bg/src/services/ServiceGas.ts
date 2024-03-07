import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IEstimateGasParams,
  IEstimateGasResp,
} from '@onekeyhq/shared/types/fee';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceGas extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async estimateFee(params: IEstimateGasParams) {
    const client = await this.getClient();

    // Temporarily delete the chain id and nonce for api testing
    // TODO: remove next two line
    delete (params.encodedTx as IEncodedTxEvm).chainId;
    delete (params.encodedTx as IEncodedTxEvm).nonce;

    const resp = await client.post<{ data: IEstimateGasResp }>(
      '/wallet/v1/account/estimate-fee',
      params,
    );
    const gasFee = resp.data.data;

    return {
      common: {
        baseFeeValue: gasFee.baseFeeValue,
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
}

export default ServiceGas;
