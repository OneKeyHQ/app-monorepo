import type { IEncodedTxCkb } from '@onekeyhq/core/src/chains/ckb/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IEstimateGasParams } from '@onekeyhq/shared/types/fee';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceGas extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _estimateFeeController: AbortController | null = null;

  @backgroundMethod()
  public async abortEstimateFee() {
    if (this._estimateFeeController) {
      this._estimateFeeController.abort();
      this._estimateFeeController = null;
    }
  }

  @backgroundMethod()
  async estimateFee(params: IEstimateGasParams) {
    const controller = new AbortController();
    this._estimateFeeController = controller;

    const vault = await vaultFactory.getVault({
      networkId: params.networkId,
      accountId: params.accountId,
    });
    const resp = await vault.estimateFee(params);

    this._estimateFeeController = null;

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
      feeSol: feeInfo.computeUnitPrice
        ? [
            {
              computeUnitPrice: feeInfo.computeUnitPrice,
            },
          ]
        : undefined,
      feeCkb: feeInfo.feeCkb
        ? feeInfo.feeCkb.map((item) => ({
            ...item,
            feeRate: (params.encodedTx as IEncodedTxCkb).feeInfo.feeRate,
          }))
        : undefined,
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

  @backgroundMethod()
  async preCheckDappTxFeeInfo(params: {
    accountId: string;
    networkId: string;
    encodedTx: IEncodedTx;
  }) {
    const { networkId, accountId, encodedTx } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const network = await vault.getNetwork();
    const encodedTxWithFee = await vault.attachFeeInfoToDAppEncodedTx({
      encodedTx,
      feeInfo: {
        common: {
          feeDecimals: network.feeMeta.decimals,
          feeSymbol: network.feeMeta.symbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
        },
      },
    });

    return encodedTxWithFee;
  }
}

export default ServiceGas;
