import BigNumber from 'bignumber.js';
import { isEqual } from 'lodash';

import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IBuildUnsignedTxParams } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import type {
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
} from '@onekeyhq/shared/types/fee';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import type { ISwapGasInfo } from '@onekeyhq/shared/types/swap/types';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';
import type {
  ISendTxBaseParams,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

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
  return gasInfos.find(
    (item) =>
      isEqual(item.encodeTx, encodedTx) ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ((item.encodeTx as any)?.rawSignTx &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (encodedTx as any)?.rawSignTx &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (item.encodeTx as any)?.rawSignTx ===
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          (encodedTx as any)?.rawSignTx),
  );
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
): ISwapGasInfo {
  return {
    common: gasCommon,
    gas: pickFeeLevelValue(gasRes.gas, networkFeeLevel),
    gasEIP1559: pickFeeLevelValue(gasRes.gasEIP1559, networkFeeLevel),
    feeUTXO: pickFeeLevelValue(gasRes.feeUTXO, networkFeeLevel),
    feeTron: pickFeeLevelValue(gasRes.feeTron, networkFeeLevel),
    feeSol: pickFeeLevelValue(gasRes.feeSol, networkFeeLevel),
    feeCkb: pickFeeLevelValue(gasRes.feeCkb, networkFeeLevel),
    feeAlgo: pickFeeLevelValue(gasRes.feeAlgo, networkFeeLevel),
    feeDot: pickFeeLevelValue(gasRes.feeDot, networkFeeLevel),
    feeBudget: pickFeeLevelValue(gasRes.feeBudget, networkFeeLevel),
  };
}

async function resolveMarketGasInfos({
  accountAddress,
  accountId,
  networkId,
  unsignedTx,
  approveUnsignedTxArr,
  networkFeeLevel,
}: {
  accountAddress: string;
  accountId: string;
  networkId: string;
  unsignedTx: IUnsignedTxPro;
  approveUnsignedTxArr?: IUnsignedTxPro[];
  networkFeeLevel?: ESwapNetworkFeeLevel;
}): Promise<IMarketGasInfoEntry[]> {
  const gasInfos: IMarketGasInfoEntry[] = [];
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

    for (let i = 0; i < unsignedTxArr.length; i += 1) {
      gasInfos.push({
        encodeTx: unsignedTxArr[i].encodedTx,
        gasInfo: buildGasInfo(
          gasResArr.txFees[i],
          gasResArr.common,
          networkFeeLevel,
        ),
      });
    }

    return gasInfos;
  }

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
        const gasInfo = buildGasInfo(gasRes, gasRes.common, networkFeeLevel);

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

  const estimateFeeParams =
    await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
      networkId,
      accountId,
      encodedTx: unsignedTx.encodedTx,
    });
  const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
    ...estimateFeeParams,
    accountAddress,
    networkId,
    accountId,
  });

  return [
    {
      encodeTx: unsignedTx.encodedTx,
      gasInfo: buildGasInfo(gasRes, gasRes.common, networkFeeLevel),
    },
  ];
}

function buildGasFeeFiatValue(gasInfos: IMarketGasInfoEntry[]) {
  const gasFeeFiatValue = gasInfos.reduce((acc, item) => {
    const feeResult = calculateFeeForSend({
      feeInfo: item.gasInfo as IFeeInfoUnit,
      nativeTokenPrice: item.gasInfo.common?.nativeTokenPrice ?? 0,
    });

    return acc.plus(new BigNumber(feeResult.totalFiatMinForDisplay));
  }, new BigNumber(0));

  return gasFeeFiatValue.isZero() ? undefined : gasFeeFiatValue.toFixed();
}

export async function estimateMarketDirectGasInfos({
  accountAddress,
  accountId,
  networkId,
  buildUnsignedParams,
  approveUnsignedTxArr,
  networkFeeLevel,
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
  });

  return {
    gasInfos,
    gasFeeFiatValue: buildGasFeeFiatValue(gasInfos),
    preparedUnsignedTx: unsignedTx,
  };
}

async function updateUnsignedTxAndSendTx({
  accountId,
  networkId,
  unsignedTxItem,
  gasInfo,
}: {
  accountId: string;
  networkId: string;
  unsignedTxItem: IUnsignedTxPro;
  gasInfo: ISwapGasInfo;
}): Promise<ISendTxOnSuccessData> {
  if (!gasInfo.common) {
    throw new OneKeyError('gasInfo.common is required');
  }

  const updatedUnsignedTxItem =
    await backgroundApiProxy.serviceSend.updateUnsignedTx({
      networkId,
      accountId,
      unsignedTx: unsignedTxItem,
      feeInfo: {
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
      },
    });

  await backgroundApiProxy.serviceSend.precheckUnsignedTxs({
    networkId,
    accountId,
    unsignedTxs: [updatedUnsignedTxItem],
    precheckTiming: ESendPreCheckTimingEnum.Confirm,
  });

  const {
    totalNative,
    total,
    totalFiat,
    totalFiatForDisplay,
    totalNativeForDisplay,
  } = calculateFeeForSend({
    feeInfo: gasInfo as IFeeInfoUnit,
    nativeTokenPrice: gasInfo.common.nativeTokenPrice ?? 0,
  });

  await backgroundApiProxy.serviceTransaction.verifyTransaction({
    networkId,
    accountId,
    verifyTxTasks: ['feeInfo'],
    verifyTxFeeInfoParams: {
      feeAmount: totalNative,
      feeTokenSymbol: gasInfo.common.nativeSymbol,
      doubleConfirm: true,
    },
    encodedTx: updatedUnsignedTxItem.encodedTx,
  });

  const signedTx = await backgroundApiProxy.serviceSend.signAndSendTransaction({
    networkId,
    accountId,
    unsignedTx: updatedUnsignedTxItem,
    signOnly: false,
  });

  const decodedTx = await backgroundApiProxy.serviceSend.buildDecodedTx({
    networkId,
    accountId,
    unsignedTx: updatedUnsignedTxItem,
    feeInfo: {
      feeInfo: gasInfo as IFeeInfoUnit,
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
      feeInfo: gasInfo as IFeeInfoUnit,
    },
  });

  return {
    signedTx,
    decodedTx,
    approveInfo: updatedUnsignedTxItem.approveInfo,
    feeInfo: gasInfo as IFeeInfoUnit,
  };
}

export async function sendMarketDirectUnsignedTxs({
  accountAddress,
  accountId,
  networkId,
  buildUnsignedParams,
  approveUnsignedTxArr,
  gasInfos = [],
  networkFeeLevel,
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
      }),
    );
  }

  return results;
}
