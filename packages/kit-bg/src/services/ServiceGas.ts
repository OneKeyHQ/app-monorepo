import BigNumber from 'bignumber.js';
import { isArray } from 'lodash';

import type { IEncodedTxCkb } from '@onekeyhq/core/src/chains/ckb/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IBatchEstimateFeeParams,
  IEstimateGasParams,
  IServerBatchEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';

import { vaultFactory } from '../vaults/factory';
import { FIL_MIN_BASE_FEE } from '../vaults/impls/fil/utils';

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
  async batchEstimateFee(params: IBatchEstimateFeeParams) {
    const controller = new AbortController();
    this._estimateFeeController = controller;

    const { accountId, networkId, encodedTxs } = params;
    const client = await this.getClient(EServiceEndpointEnum.Wallet);

    const resp = await client.post<IServerBatchEstimateFeeResponse>(
      '/wallet/v1/account/estimate-fee-batch',
      {
        networkId,
        encodedTxList: encodedTxs,
      },
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );

    this._estimateFeeController = null;

    const feeInfo = resp.data.data;

    const batchFeeResult = {
      common: {
        baseFee: feeInfo.baseFee,
        feeDecimals: feeInfo.feeDecimals,
        feeSymbol: feeInfo.feeSymbol,
        nativeDecimals: feeInfo.nativeDecimals,
        nativeSymbol: feeInfo.nativeSymbol,
        nativeTokenPrice: feeInfo.nativeTokenPrice?.price,
      },
      txFees: feeInfo.result,
    };

    return batchFeeResult;
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

    const feeResult = {
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
      feeAlgo: (isArray(feeInfo.feeAlgo)
        ? feeInfo.feeAlgo
        : [feeInfo.feeAlgo]
      ).filter((item) => !!item),
      feeDot: feeInfo.feeData
        ?.map((item) => {
          if (!item.extraTip || feeInfo.feeDecimals === undefined) {
            return undefined;
          }
          return {
            extraTipInDot: new BigNumber(item.extraTip)
              .shiftedBy(-feeInfo.feeDecimals)
              .toFixed(),
          };
        })
        .filter((item) => !!item),
      feeBudget: feeInfo.feeBudget?.map((item) => {
        if (!item.gasPrice) {
          throw new Error('gasPrice is undefined');
        }
        return {
          ...item,
          computationCostBase: item.computationCost ? new BigNumber(item.computationCost)
            .dividedBy(
              new BigNumber(item.gasPrice).shiftedBy(feeInfo.feeDecimals),
            )
            .toFixed() : '0',
        };
      }),
    };

    // Since FIL's fee structure is similar to EIP1559, map FIL fees to EIP1559 format to reuse related logic
    if (feeInfo.gasFil && !feeInfo.gasEIP1559) {
      feeResult.common.feeSymbol = feeResult.common.nativeSymbol;
      feeResult.common.feeDecimals = feeResult.common.nativeDecimals;

      feeResult.gasEIP1559 = feeInfo.gasFil.map((item) => ({
        baseFeePerGas: new BigNumber(FIL_MIN_BASE_FEE)
          .shiftedBy(-feeResult.common.feeDecimals)
          .toFixed(),
        maxFeePerGas: new BigNumber(item.gasFeeCap)
          .shiftedBy(-feeResult.common.feeDecimals)
          .toFixed(),
        maxPriorityFeePerGas: new BigNumber(item.gasPremium)
          .shiftedBy(-feeResult.common.feeDecimals)
          .toFixed(),
        gasLimit: item.gasLimit,
        gasLimitForDisplay: item.gasLimit,
      }));
    }

    return feeResult;
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
