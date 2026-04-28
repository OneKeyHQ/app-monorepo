import BigNumber from 'bignumber.js';

import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IBuildUnsignedTxParams } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import { applyCustomPriorityFeeToGasInfo } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import type {
  IEstimateFeeParams,
  IFeeAlgo,
  IFeeCkb,
  IFeeDot,
  IFeeInfoUnit,
  IFeeSol,
  IFeeSui,
  IFeeTron,
  IFeeUTXO,
  IGasEIP1559,
  IGasLegacy,
  ITronResourceRentalInfo,
} from '@onekeyhq/shared/types/fee';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import type { ISwapGasInfo } from '@onekeyhq/shared/types/swap/types';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';
import type {
  ISendTxBaseParams,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { isEncodedTxMatch } from './marketEncodedTxUtils';

import type { IMarketPresetPriorityFeeOverride } from './marketPresetSettings';

export type IMarketGasInfoEntry = {
  encodeTx: IEncodedTx;
  gasInfo: ISwapGasInfo;
};

type IMarketDirectSendParams = {
  accountAddress: string;
  accountId: string;
  networkId: string;
  buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams;
  approveUnsignedTxArr?: IUnsignedTxPro[];
  gasInfos?: IMarketGasInfoEntry[];
  networkFeeLevel?: ESwapNetworkFeeLevel;
  customPriorityFee?: IMarketPresetPriorityFeeOverride;
  tronResourceRentalInfo?: ITronResourceRentalInfo;
  useDefaultRpc?: boolean;
};

type IEstimateMarketDirectGasInfosParams = Omit<
  IMarketDirectSendParams,
  'gasInfos'
>;

function pickFeeLevelValue<T>(
  values: T[] | undefined,
  networkFeeLevel?: ESwapNetworkFeeLevel,
): T | undefined {
  if (networkFeeLevel === ESwapNetworkFeeLevel.LOW) {
    return values?.[0];
  }

  if (networkFeeLevel === ESwapNetworkFeeLevel.HIGH) {
    return values?.[2] ?? values?.[1] ?? values?.[0];
  }

  return values?.[1] ?? values?.[0];
}

function pickTronFeeLevelValue(
  values: IFeeTron[] | undefined,
  networkFeeLevel?: ESwapNetworkFeeLevel,
): IFeeTron | undefined {
  if (networkFeeLevel === ESwapNetworkFeeLevel.LOW) {
    return values?.[0];
  }

  // Keep Market review aligned with the legacy Swap/Market fallback flow.
  if (networkFeeLevel === ESwapNetworkFeeLevel.HIGH) {
    return values?.[0];
  }

  return values?.[1] ?? values?.[0];
}

function buildUnsignedTxArr({
  unsignedTx,
  approveUnsignedTxArr,
}: {
  unsignedTx: IUnsignedTxPro;
  approveUnsignedTxArr?: IUnsignedTxPro[];
}) {
  return approveUnsignedTxArr?.length
    ? [...approveUnsignedTxArr, unsignedTx]
    : [unsignedTx];
}

function findGasInfo(
  gasInfos: IMarketGasInfoEntry[],
  encodedTx: IEncodedTx,
): IMarketGasInfoEntry | undefined {
  return gasInfos.find((item) => isEncodedTxMatch(item.encodeTx, encodedTx));
}

function buildGasInfo(
  gasRes: {
    gas?: IGasLegacy[];
    gasEIP1559?: IGasEIP1559[];
    feeUTXO?: IFeeUTXO[];
    feeTron?: IFeeTron[];
    feeSol?: IFeeSol[];
    feeCkb?: IFeeCkb[];
    feeAlgo?: IFeeAlgo[];
    feeDot?: IFeeDot[];
    feeBudget?: IFeeSui[];
  },
  gasCommon: {
    baseFee?: string;
    feeDecimals: number;
    feeSymbol: string;
    nativeDecimals: number;
    nativeSymbol: string;
    nativeTokenPrice?: number;
  },
  networkFeeLevel?: ESwapNetworkFeeLevel,
  customPriorityFee?: IMarketPresetPriorityFeeOverride,
  estimateFeeParams?: IEstimateFeeParams,
): ISwapGasInfo {
  return applyCustomPriorityFeeToGasInfo({
    gasInfo: {
      common: gasCommon,
      gas: pickFeeLevelValue(gasRes.gas, networkFeeLevel),
      gasEIP1559: pickFeeLevelValue(gasRes.gasEIP1559, networkFeeLevel),
      feeUTXO: pickFeeLevelValue(gasRes.feeUTXO, networkFeeLevel),
      feeTron: pickTronFeeLevelValue(gasRes.feeTron, networkFeeLevel),
      feeSol: pickFeeLevelValue(gasRes.feeSol, networkFeeLevel),
      feeCkb: pickFeeLevelValue(gasRes.feeCkb, networkFeeLevel),
      feeAlgo: pickFeeLevelValue(gasRes.feeAlgo, networkFeeLevel),
      feeDot: pickFeeLevelValue(gasRes.feeDot, networkFeeLevel),
      feeBudget: pickFeeLevelValue(gasRes.feeBudget, networkFeeLevel),
    },
    customPriorityFee,
    estimateFeeParams,
  });
}

async function estimateUnsignedTxGasInfo({
  accountAddress,
  accountId,
  networkId,
  unsignedTxItem,
  networkFeeLevel,
  customPriorityFee,
}: {
  accountAddress: string;
  accountId: string;
  networkId: string;
  unsignedTxItem: IUnsignedTxPro;
  networkFeeLevel?: ESwapNetworkFeeLevel;
  customPriorityFee?: IMarketPresetPriorityFeeOverride;
}) {
  const estimateFeeParams =
    await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
      networkId,
      accountId,
      encodedTx: unsignedTxItem.encodedTx,
    });
  const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
    ...estimateFeeParams,
    accountAddress,
    networkId,
    accountId,
  });

  return buildGasInfo(
    gasRes,
    gasRes.common,
    networkFeeLevel,
    customPriorityFee,
    estimateFeeParams.estimateFeeParams,
  );
}

async function resolveMarketGasInfosSequentially({
  accountAddress,
  accountId,
  networkId,
  unsignedTx,
  approveUnsignedTxArr,
  networkFeeLevel,
  customPriorityFee,
}: {
  accountAddress: string;
  accountId: string;
  networkId: string;
  unsignedTx: IUnsignedTxPro;
  approveUnsignedTxArr?: IUnsignedTxPro[];
  networkFeeLevel?: ESwapNetworkFeeLevel;
  customPriorityFee?: IMarketPresetPriorityFeeOverride;
}): Promise<IMarketGasInfoEntry[]> {
  const gasInfos: IMarketGasInfoEntry[] = [];
  const unsignedTxArr = buildUnsignedTxArr({
    unsignedTx,
    approveUnsignedTxArr,
  });

  if (approveUnsignedTxArr?.length) {
    let lastTxUseGasInfo: IFeeInfoUnit | undefined;

    for (let i = 0; i < unsignedTxArr.length; i += 1) {
      const unsignedTxItem = unsignedTxArr[i];

      if (i === unsignedTxArr.length - 1) {
        const internalSwapGasLimit =
          unsignedTxItem.swapInfo?.swapBuildResData.result.gasLimit;
        const internalSwapRoutes =
          unsignedTxItem.swapInfo?.swapBuildResData.result.routesData;
        const baseGasLimit =
          lastTxUseGasInfo?.gas?.gasLimit ??
          lastTxUseGasInfo?.gasEIP1559?.gasLimit;

        let specialGasLimit: string | undefined;
        if (
          typeof internalSwapGasLimit !== 'undefined' &&
          internalSwapGasLimit !== null
        ) {
          specialGasLimit = new BigNumber(internalSwapGasLimit).toFixed();
        } else if (internalSwapRoutes && internalSwapRoutes.length > 0) {
          const allRoutesLength = internalSwapRoutes.reduce(
            (acc, cur) => acc.plus(cur.subRoutes?.flat().length ?? 1),
            new BigNumber(0),
          );
          specialGasLimit = new BigNumber(baseGasLimit ?? 0)
            .times(
              allRoutesLength
                .plus(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP)
                .plus(BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP),
            )
            .toFixed();
        } else {
          specialGasLimit = new BigNumber(baseGasLimit ?? 0)
            .times(
              new BigNumber(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP).plus(
                BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
              ),
            )
            .toFixed();
        }

        gasInfos.push({
          encodeTx: unsignedTxItem.encodedTx,
          gasInfo: {
            common: lastTxUseGasInfo?.common,
            gas: lastTxUseGasInfo?.gas
              ? {
                  ...lastTxUseGasInfo.gas,
                  gasLimit: specialGasLimit ?? lastTxUseGasInfo.gas.gasLimit,
                }
              : undefined,
            gasEIP1559: lastTxUseGasInfo?.gasEIP1559
              ? {
                  ...lastTxUseGasInfo.gasEIP1559,
                  gasLimit:
                    specialGasLimit ?? lastTxUseGasInfo.gasEIP1559.gasLimit,
                }
              : undefined,
          },
        });
      } else {
        const gasInfo = await estimateUnsignedTxGasInfo({
          accountAddress,
          accountId,
          networkId,
          unsignedTxItem,
          networkFeeLevel,
          customPriorityFee,
        });

        if (i === unsignedTxArr.length - 2) {
          lastTxUseGasInfo = gasInfo as IFeeInfoUnit;
        }

        gasInfos.push({
          encodeTx: unsignedTxItem.encodedTx,
          gasInfo,
        });
      }
    }

    return gasInfos;
  }

  return [
    {
      encodeTx: unsignedTx.encodedTx,
      gasInfo: await estimateUnsignedTxGasInfo({
        accountAddress,
        accountId,
        networkId,
        unsignedTxItem: unsignedTx,
        networkFeeLevel,
        customPriorityFee,
      }),
    },
  ];
}

async function resolveMarketGasInfos({
  accountAddress,
  accountId,
  networkId,
  unsignedTx,
  approveUnsignedTxArr,
  networkFeeLevel,
  customPriorityFee,
}: {
  accountAddress: string;
  accountId: string;
  networkId: string;
  unsignedTx: IUnsignedTxPro;
  approveUnsignedTxArr?: IUnsignedTxPro[];
  networkFeeLevel?: ESwapNetworkFeeLevel;
  customPriorityFee?: IMarketPresetPriorityFeeOverride;
}): Promise<IMarketGasInfoEntry[]> {
  const unsignedTxArr = buildUnsignedTxArr({
    unsignedTx,
    approveUnsignedTxArr,
  });
  const vaultSettings =
    await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId,
    });

  if (
    approveUnsignedTxArr?.length &&
    vaultSettings.supportBatchEstimateFee?.[networkId]
  ) {
    const estimateFeeParamsArr = await Promise.all(
      unsignedTxArr.map((item) =>
        backgroundApiProxy.serviceGas.buildEstimateFeeParams({
          networkId,
          accountId,
          encodedTx: item.encodedTx,
        }),
      ),
    );

    const gasResArr = await backgroundApiProxy.serviceGas.batchEstimateFee({
      networkId,
      accountId,
      encodedTxs: estimateFeeParamsArr.map((item) => item.encodedTx ?? {}),
    });

    if (gasResArr.txFees.length !== unsignedTxArr.length) {
      return resolveMarketGasInfosSequentially({
        accountAddress,
        accountId,
        networkId,
        unsignedTx,
        approveUnsignedTxArr,
        networkFeeLevel,
        customPriorityFee,
      });
    }

    return unsignedTxArr.map((unsignedTxItem, index) => ({
      encodeTx: unsignedTxItem.encodedTx,
      gasInfo: buildGasInfo(
        gasResArr.txFees[index],
        gasResArr.common,
        networkFeeLevel,
        customPriorityFee,
        estimateFeeParamsArr[index].estimateFeeParams,
      ),
    }));
  }

  return resolveMarketGasInfosSequentially({
    accountAddress,
    accountId,
    networkId,
    unsignedTx,
    approveUnsignedTxArr,
    networkFeeLevel,
    customPriorityFee,
  });
}

async function resolveExactUnsignedTxGasInfos({
  accountAddress,
  accountId,
  networkId,
  unsignedTxArr,
  networkFeeLevel,
  customPriorityFee,
}: {
  accountAddress: string;
  accountId: string;
  networkId: string;
  unsignedTxArr: IUnsignedTxPro[];
  networkFeeLevel?: ESwapNetworkFeeLevel;
  customPriorityFee?: IMarketPresetPriorityFeeOverride;
}): Promise<IMarketGasInfoEntry[]> {
  const gasInfos: IMarketGasInfoEntry[] = [];
  const vaultSettings =
    await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId,
    });

  if (
    unsignedTxArr.length > 1 &&
    vaultSettings.supportBatchEstimateFee?.[networkId]
  ) {
    const estimateFeeParamsArr = await Promise.all(
      unsignedTxArr.map((item) =>
        backgroundApiProxy.serviceGas.buildEstimateFeeParams({
          networkId,
          accountId,
          encodedTx: item.encodedTx,
        }),
      ),
    );

    const gasResArr = await backgroundApiProxy.serviceGas.batchEstimateFee({
      networkId,
      accountId,
      encodedTxs: estimateFeeParamsArr.map((item) => item.encodedTx ?? {}),
    });

    if (gasResArr.txFees.length !== unsignedTxArr.length) {
      const fallbackGasInfos: IMarketGasInfoEntry[] = [];
      for (const unsignedTxItem of unsignedTxArr) {
        const gasInfo = await estimateUnsignedTxGasInfo({
          accountAddress,
          accountId,
          networkId,
          unsignedTxItem,
          networkFeeLevel,
          customPriorityFee,
        });

        fallbackGasInfos.push({
          encodeTx: unsignedTxItem.encodedTx,
          gasInfo,
        });
      }

      return fallbackGasInfos;
    }

    return unsignedTxArr.map((unsignedTxItem, index) => ({
      encodeTx: unsignedTxItem.encodedTx,
      gasInfo: buildGasInfo(
        gasResArr.txFees[index],
        gasResArr.common,
        networkFeeLevel,
        customPriorityFee,
        estimateFeeParamsArr[index].estimateFeeParams,
      ),
    }));
  }

  for (const unsignedTxItem of unsignedTxArr) {
    gasInfos.push({
      encodeTx: unsignedTxItem.encodedTx,
      gasInfo: await estimateUnsignedTxGasInfo({
        accountAddress,
        accountId,
        networkId,
        unsignedTxItem,
        networkFeeLevel,
        customPriorityFee,
      }),
    });
  }

  return gasInfos;
}

function buildGasFeeFiatValue(gasInfos: IMarketGasInfoEntry[]) {
  const gasFeeFiatValue = gasInfos.reduce((acc, item) => {
    if (!item.gasInfo.common) {
      return acc;
    }

    const feeResult = calculateFeeForSend({
      feeInfo: item.gasInfo as IFeeInfoUnit,
      nativeTokenPrice: item.gasInfo.common.nativeTokenPrice ?? 0,
    });

    return acc.plus(new BigNumber(feeResult.totalFiatMinForDisplay));
  }, new BigNumber(0));

  return gasFeeFiatValue.isZero() ? undefined : gasFeeFiatValue.toFixed();
}

export function buildMarketGasInfoFeeInfo(gasInfo: ISwapGasInfo): IFeeInfoUnit {
  if (!gasInfo.common) {
    throw new OneKeyError('gasInfo.common is required');
  }

  return {
    common: {
      baseFee: gasInfo.common.baseFee,
      feeDecimals: gasInfo.common.feeDecimals,
      feeSymbol: gasInfo.common.feeSymbol,
      nativeDecimals: gasInfo.common.nativeDecimals,
      nativeSymbol: gasInfo.common.nativeSymbol,
      nativeTokenPrice: gasInfo.common.nativeTokenPrice,
    },
    gas: gasInfo.gas,
    gasEIP1559: gasInfo.gasEIP1559,
    feeUTXO: gasInfo.feeUTXO,
    feeTron: gasInfo.feeTron,
    feeSol: gasInfo.feeSol,
    feeCkb: gasInfo.feeCkb,
    feeAlgo: gasInfo.feeAlgo,
    feeDot: gasInfo.feeDot,
    feeBudget: gasInfo.feeBudget,
  };
}

export async function estimateMarketDirectGasInfos({
  accountAddress,
  accountId,
  networkId,
  buildUnsignedParams,
  approveUnsignedTxArr,
  networkFeeLevel,
  customPriorityFee,
}: IEstimateMarketDirectGasInfosParams): Promise<{
  gasInfos: IMarketGasInfoEntry[];
  gasFeeFiatValue?: string;
  preparedUnsignedTx: IUnsignedTxPro;
}> {
  if (!accountId || !networkId || !accountAddress) {
    throw new OneKeyError('account error');
  }

  const buildUnsignedParamsCheckNonce = { ...buildUnsignedParams };
  if (approveUnsignedTxArr?.length) {
    buildUnsignedParamsCheckNonce.prevNonce =
      approveUnsignedTxArr[approveUnsignedTxArr.length - 1].nonce;
  }

  const unsignedTx =
    await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
      ...buildUnsignedParamsCheckNonce,
      isInternalSwap: true,
    });

  const gasInfos = await resolveMarketGasInfos({
    accountAddress,
    accountId,
    networkId,
    unsignedTx,
    approveUnsignedTxArr,
    networkFeeLevel,
    customPriorityFee,
  });

  return {
    gasInfos,
    gasFeeFiatValue: buildGasFeeFiatValue(gasInfos),
    preparedUnsignedTx: unsignedTx,
  };
}

export async function estimateMarketApproveGasInfos({
  accountAddress,
  accountId,
  networkId,
  approveUnsignedTxArr,
  networkFeeLevel,
  customPriorityFee,
}: {
  accountAddress: string;
  accountId: string;
  networkId: string;
  approveUnsignedTxArr: IUnsignedTxPro[];
  networkFeeLevel?: ESwapNetworkFeeLevel;
  customPriorityFee?: IMarketPresetPriorityFeeOverride;
}): Promise<{
  gasInfos: IMarketGasInfoEntry[];
  gasFeeFiatValue?: string;
}> {
  if (!accountId || !networkId || !accountAddress) {
    throw new OneKeyError('account error');
  }

  if (!approveUnsignedTxArr.length) {
    return {
      gasInfos: [],
      gasFeeFiatValue: undefined,
    };
  }

  const gasInfos = await resolveExactUnsignedTxGasInfos({
    accountAddress,
    accountId,
    networkId,
    unsignedTxArr: approveUnsignedTxArr,
    networkFeeLevel,
    customPriorityFee,
  });

  return {
    gasInfos,
    gasFeeFiatValue: buildGasFeeFiatValue(gasInfos),
  };
}

async function updateUnsignedTxAndSendTx({
  accountId,
  networkId,
  unsignedTxItem,
  gasInfo,
  tronResourceRentalInfo,
  useDefaultRpc,
}: {
  accountId: string;
  networkId: string;
  unsignedTxItem: IUnsignedTxPro;
  gasInfo: ISwapGasInfo;
  tronResourceRentalInfo?: ITronResourceRentalInfo;
  useDefaultRpc?: boolean;
}): Promise<ISendTxOnSuccessData> {
  const feeInfo = buildMarketGasInfoFeeInfo(gasInfo);

  const updatedUnsignedTxItem =
    await backgroundApiProxy.serviceSend.updateUnsignedTx({
      networkId,
      accountId,
      unsignedTx: unsignedTxItem,
      feeInfo,
      tronResourceRentalInfo,
    });

  await backgroundApiProxy.serviceSend.precheckUnsignedTxs({
    networkId,
    accountId,
    unsignedTxs: [updatedUnsignedTxItem],
    precheckTiming: ESendPreCheckTimingEnum.Confirm,
  });

  await backgroundApiProxy.serviceSignatureConfirm.preActionsBeforeSending({
    accountId,
    networkId,
    unsignedTxs: [updatedUnsignedTxItem],
    tronResourceRentalInfo,
  });

  const {
    totalNative,
    total,
    totalFiat,
    totalFiatForDisplay,
    totalNativeForDisplay,
  } = calculateFeeForSend({
    feeInfo,
    nativeTokenPrice: feeInfo.common.nativeTokenPrice ?? 0,
  });

  await backgroundApiProxy.serviceTransaction.verifyTransaction({
    networkId,
    accountId,
    verifyTxTasks: ['feeInfo'],
    verifyTxFeeInfoParams: {
      feeAmount: totalNative,
      feeTokenSymbol: feeInfo.common.nativeSymbol,
      doubleConfirm: true,
    },
    encodedTx: updatedUnsignedTxItem.encodedTx,
  });

  const signedTx = await backgroundApiProxy.serviceSend.signAndSendTransaction({
    networkId,
    accountId,
    unsignedTx: updatedUnsignedTxItem,
    signOnly: false,
    tronResourceRentalInfo,
    useDefaultRpc,
  });

  const decodedTx = await backgroundApiProxy.serviceSend.buildDecodedTx({
    networkId,
    accountId,
    unsignedTx: updatedUnsignedTxItem,
    feeInfo: {
      feeInfo,
      total,
      totalNative,
      totalFiat,
      totalNativeForDisplay,
      totalFiatForDisplay,
    },
    saveToLocalHistory: true,
  });

  await backgroundApiProxy.serviceHistory.saveSendConfirmHistoryTxs({
    networkId,
    accountId,
    data: {
      signedTx,
      decodedTx,
      approveInfo: updatedUnsignedTxItem.approveInfo,
      feeInfo,
    },
  });

  const result = {
    signedTx,
    decodedTx,
    approveInfo: updatedUnsignedTxItem.approveInfo,
    feeInfo,
  };

  const vaultSettings =
    await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId,
    });

  if (vaultSettings?.afterSendTxActionEnabled) {
    await backgroundApiProxy.serviceSignatureConfirm.afterSendTxAction({
      networkId,
      accountId,
      result: [result],
    });
  }

  return result;
}

export async function sendMarketDirectUnsignedTxs({
  accountAddress,
  accountId,
  networkId,
  buildUnsignedParams,
  approveUnsignedTxArr,
  gasInfos = [],
  networkFeeLevel,
  customPriorityFee,
  tronResourceRentalInfo,
  useDefaultRpc,
}: IMarketDirectSendParams): Promise<ISendTxOnSuccessData[]> {
  if (!accountId || !networkId || !accountAddress) {
    throw new OneKeyError('account error');
  }

  const buildUnsignedParamsCheckNonce = { ...buildUnsignedParams };
  if (approveUnsignedTxArr?.length) {
    buildUnsignedParamsCheckNonce.prevNonce =
      approveUnsignedTxArr[approveUnsignedTxArr.length - 1].nonce;
  }

  const unsignedTx =
    await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
      ...buildUnsignedParamsCheckNonce,
      isInternalSwap: true,
    });

  const results: ISendTxOnSuccessData[] = [];
  const unsignedTxArr = buildUnsignedTxArr({
    unsignedTx,
    approveUnsignedTxArr,
  });
  let gasInfosFinal = gasInfos;

  if (!unsignedTxArr.every((tx) => findGasInfo(gasInfosFinal, tx.encodedTx))) {
    gasInfosFinal = await resolveMarketGasInfos({
      accountAddress,
      accountId,
      networkId,
      unsignedTx,
      approveUnsignedTxArr,
      networkFeeLevel,
      customPriorityFee,
    });
  }

  for (const unsignedTxItem of unsignedTxArr) {
    const gasInfo = findGasInfo(
      gasInfosFinal,
      unsignedTxItem.encodedTx,
    )?.gasInfo;
    if (!gasInfo) {
      throw new OneKeyError('gas info not found');
    }

    results.push(
      await updateUnsignedTxAndSendTx({
        accountId,
        networkId,
        unsignedTxItem,
        gasInfo,
        tronResourceRentalInfo,
        useDefaultRpc,
      }),
    );
  }

  return results;
}
