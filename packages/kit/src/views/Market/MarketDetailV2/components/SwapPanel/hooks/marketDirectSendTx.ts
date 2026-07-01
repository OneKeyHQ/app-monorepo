import BigNumber from 'bignumber.js';

import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EGasAccountErrorStrategy,
  getGasAccountErrorEntry,
} from '@onekeyhq/kit/src/views/SignatureConfirm/constants/gasAccountErrorCodes';
import type {
  IBuildUnsignedTxParams,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { BTC_TX_PLACEHOLDER_VSIZE } from '@onekeyhq/shared/src/consts/chainConsts';
import {
  BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { getGasAccountErrorCode } from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
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
  IGasAccountQuote,
  IGasAccountUiState,
  IGasEIP1559,
  IGasLegacy,
  IGasPayer,
  ITronResourceRentalInfo,
} from '@onekeyhq/shared/types/fee';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import type {
  ISwapGasInfo,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';
import type {
  ISendTxBaseParams,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { isEncodedTxMatch } from './marketEncodedTxUtils';

import type { IMarketPresetPriorityFeeOverride } from './marketPresetSettings';

export type IMarketGasInfoEntry = {
  encodeTx: IEncodedTx;
  gasInfo: ISwapGasInfo;
  estimateFeeParams?: IEstimateFeeParams;
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

export type IMarketPresetFeeEstimateFakeTxToken = Pick<
  ISwapTokenBase,
  | 'contractAddress'
  | 'decimals'
  | 'isNative'
  | 'logoURI'
  | 'name'
  | 'networkId'
  | 'symbol'
>;

const MARKET_PRESET_SOL_DEFAULT_COMPUTE_UNIT_LIMIT = '200000';
const MARKET_PRESET_SOL_BASE_FEE = '5000';
const MARKET_PRESET_SOL_COMPUTE_UNIT_PRICE_DECIMALS = 6;

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
    payer?: IGasPayer;
    gasAccountEligible?: boolean;
    gasAccountQuote?: IGasAccountQuote;
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
  const gasInfo = applyCustomPriorityFeeToGasInfo({
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
  // Carry Gas Account sponsorship result from estimate-fee so the send path can
  // attach the broadcast quoteId for sponsored Market Pro swaps.
  return {
    ...gasInfo,
    payer: gasRes.payer,
    gasAccountEligible: gasRes.gasAccountEligible,
    gasAccountQuote: gasRes.gasAccountQuote,
  };
}

function buildNativeTokenPrice(price?: string | number) {
  const priceBN = new BigNumber(price ?? 0);

  return priceBN.isNaN() || !priceBN.isFinite() || priceBN.lte(0)
    ? undefined
    : priceBN.toNumber();
}

export async function resolveMarketPresetNativeTokenPrice({
  currencyId,
  networkId,
  tokens,
}: {
  currencyId: string;
  networkId: string;
  tokens: (
    | Pick<ISwapTokenBase, 'isNative' | 'networkId' | 'price'>
    | undefined
  )[];
}) {
  const nativeTokenPrice = tokens.find(
    (token) => token?.isNative && token.networkId === networkId,
  )?.price;

  if (nativeTokenPrice) {
    return nativeTokenPrice;
  }

  try {
    const nativeTokenAddress =
      await backgroundApiProxy.serviceToken.getNativeTokenAddress({
        networkId,
      });
    const [nativeTokenDetail] =
      (await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
        networkId,
        contractAddress: nativeTokenAddress ?? '',
        currency: currencyId,
      })) ?? [];

    return nativeTokenDetail?.price;
  } catch {
    return undefined;
  }
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
}): Promise<Omit<IMarketGasInfoEntry, 'encodeTx'>> {
  const estimateFeeParamsResult =
    await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
      networkId,
      accountId,
      encodedTx: unsignedTxItem.encodedTx,
    });
  // Gas Account sponsorship pre-check from the build-tx response carried on the
  // unsigned tx; forwarded so estimate-fee can return real eligibility/quote.
  const gasAccountEnabled =
    !!unsignedTxItem.swapInfo?.swapBuildResData?.result?.gasAccountEnabled;
  const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
    ...estimateFeeParamsResult,
    accountAddress,
    networkId,
    accountId,
    scenario: 'swap',
    gasAccountEnabled,
    transfersInfo: unsignedTxItem.transfersInfo,
    // Bind the sponsor quote to the nonce that will actually broadcast (same
    // unsignedTx is signed later), mirroring the transaction-confirm page.
    lockedUserNonce:
      typeof unsignedTxItem.nonce === 'number'
        ? unsignedTxItem.nonce
        : undefined,
  });

  return {
    gasInfo: buildGasInfo(
      gasRes,
      gasRes.common,
      networkFeeLevel,
      customPriorityFee,
      estimateFeeParamsResult.estimateFeeParams,
    ),
    estimateFeeParams: estimateFeeParamsResult.estimateFeeParams,
  };
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
        const gasInfoEntry = await estimateUnsignedTxGasInfo({
          accountAddress,
          accountId,
          networkId,
          unsignedTxItem,
          networkFeeLevel,
          customPriorityFee,
        });

        if (i === unsignedTxArr.length - 2) {
          lastTxUseGasInfo = gasInfoEntry.gasInfo as IFeeInfoUnit;
        }

        gasInfos.push({
          encodeTx: unsignedTxItem.encodedTx,
          ...gasInfoEntry,
        });
      }
    }

    return gasInfos;
  }

  return [
    {
      encodeTx: unsignedTx.encodedTx,
      ...(await estimateUnsignedTxGasInfo({
        accountAddress,
        accountId,
        networkId,
        unsignedTxItem: unsignedTx,
        networkFeeLevel,
        customPriorityFee,
      })),
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
      estimateFeeParams: estimateFeeParamsArr[index].estimateFeeParams,
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
        const gasInfoEntry = await estimateUnsignedTxGasInfo({
          accountAddress,
          accountId,
          networkId,
          unsignedTxItem,
          networkFeeLevel,
          customPriorityFee,
        });

        fallbackGasInfos.push({
          encodeTx: unsignedTxItem.encodedTx,
          ...gasInfoEntry,
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
      estimateFeeParams: estimateFeeParamsArr[index].estimateFeeParams,
    }));
  }

  for (const unsignedTxItem of unsignedTxArr) {
    const gasInfoEntry = await estimateUnsignedTxGasInfo({
      accountAddress,
      accountId,
      networkId,
      unsignedTxItem,
      networkFeeLevel,
      customPriorityFee,
    });
    gasInfos.push({
      encodeTx: unsignedTxItem.encodedTx,
      ...gasInfoEntry,
    });
  }

  return gasInfos;
}

function pickPositiveFeeValue(...values: (string | number | undefined)[]) {
  for (const value of values) {
    const valueBN = new BigNumber(value ?? 0);
    if (!valueBN.isNaN() && valueBN.isFinite() && valueBN.gt(0)) {
      return valueBN.toFixed();
    }
  }
}

function normalizeMarketPresetGasLimitForDisplay({
  gasLimitForDisplay,
  gasInfo,
}: {
  gasLimitForDisplay?: string | number;
  gasInfo: ISwapGasInfo;
}): ISwapGasInfo {
  const gasLimit = gasInfo.gas
    ? pickPositiveFeeValue(
        gasInfo.gas.gasLimit,
        gasInfo.gas.gasLimitForDisplay,
        gasLimitForDisplay,
      )
    : undefined;
  const gasEIP1559Limit = gasInfo.gasEIP1559
    ? pickPositiveFeeValue(
        gasInfo.gasEIP1559.gasLimit,
        gasInfo.gasEIP1559.gasLimitForDisplay,
        gasLimitForDisplay,
      )
    : undefined;
  const gasLimitForDisplayValue = gasInfo.gas
    ? pickPositiveFeeValue(
        gasInfo.gas.gasLimitForDisplay,
        gasInfo.gas.gasLimit,
        gasLimitForDisplay,
      )
    : undefined;
  const gasEIP1559LimitForDisplay = gasInfo.gasEIP1559
    ? pickPositiveFeeValue(
        gasInfo.gasEIP1559.gasLimitForDisplay,
        gasInfo.gasEIP1559.gasLimit,
        gasLimitForDisplay,
      )
    : undefined;

  return {
    ...gasInfo,
    gas: gasInfo.gas
      ? {
          ...gasInfo.gas,
          ...(gasLimit ? { gasLimit } : undefined),
          ...(gasLimitForDisplayValue
            ? { gasLimitForDisplay: gasLimitForDisplayValue }
            : undefined),
        }
      : undefined,
    gasEIP1559: gasInfo.gasEIP1559
      ? {
          ...gasInfo.gasEIP1559,
          ...(gasEIP1559Limit ? { gasLimit: gasEIP1559Limit } : undefined),
          ...(gasEIP1559LimitForDisplay
            ? { gasLimitForDisplay: gasEIP1559LimitForDisplay }
            : undefined),
        }
      : undefined,
  };
}

function buildMarketPresetEstimateFeeParams(
  gasInfo: ISwapGasInfo,
): IEstimateFeeParams | undefined {
  if (!gasInfo.feeSol) {
    return undefined;
  }

  return {
    estimateFeeParamsSol: {
      baseFee: gasInfo.common?.baseFee ?? MARKET_PRESET_SOL_BASE_FEE,
      computeUnitLimit: MARKET_PRESET_SOL_DEFAULT_COMPUTE_UNIT_LIMIT,
      computeUnitPriceDecimals: MARKET_PRESET_SOL_COMPUTE_UNIT_PRICE_DECIMALS,
    },
  };
}

function getMarketPresetFeeTxSize(gasInfo: ISwapGasInfo) {
  if (gasInfo.feeUTXO?.feeRate && !gasInfo.feeUTXO.feeValue) {
    return BTC_TX_PLACEHOLDER_VSIZE;
  }
}

function buildGasFeeFiatValue(
  gasInfos: {
    gasInfo: ISwapGasInfo;
    estimateFeeParams?: IEstimateFeeParams;
    txSize?: number;
  }[],
) {
  const gasFeeFiatValue = gasInfos.reduce((acc, item) => {
    if (!item.gasInfo.common) {
      return acc;
    }

    const feeResult = calculateFeeForSend({
      feeInfo: item.gasInfo as IFeeInfoUnit,
      nativeTokenPrice: item.gasInfo.common.nativeTokenPrice ?? 0,
      estimateFeeParams: item.estimateFeeParams,
      txSize: item.txSize,
    });
    const fiatValue = new BigNumber(feeResult.totalFiatMinForDisplay);

    if (fiatValue.isNaN() || !fiatValue.isFinite() || fiatValue.lte(0)) {
      return acc;
    }

    return acc.plus(fiatValue);
  }, new BigNumber(0));

  return gasFeeFiatValue.isZero() ? undefined : gasFeeFiatValue.toFixed();
}

function buildMarketPresetFakeTxAmount(amount?: string) {
  const amountBN = new BigNumber(amount ?? 0);

  return amountBN.isNaN() || !amountBN.isFinite() || amountBN.lt(0)
    ? '0'
    : amountBN.toFixed();
}

function buildMarketPresetFakeTxTokenInfo(
  token: IMarketPresetFeeEstimateFakeTxToken,
): IToken | undefined {
  if (!token.networkId || (!token.isNative && !token.contractAddress)) {
    return undefined;
  }

  return {
    address: token.contractAddress ?? '',
    decimals: token.decimals,
    isNative: !!token.isNative,
    logoURI: token.logoURI,
    name: token.name ?? token.symbol,
    networkId: token.networkId,
    symbol: token.symbol,
  };
}

export function buildMarketPresetFeeEstimateFakeTransferInfo({
  accountAddress,
  amount,
  token,
}: {
  accountAddress: string;
  amount?: string;
  token: IMarketPresetFeeEstimateFakeTxToken;
}): ITransferInfo | undefined {
  const tokenInfo = buildMarketPresetFakeTxTokenInfo(token);
  if (!accountAddress || !tokenInfo) {
    return undefined;
  }

  return {
    amount: buildMarketPresetFakeTxAmount(amount),
    from: accountAddress,
    to: accountAddress,
    tokenInfo,
  };
}

export async function buildMarketPresetFeeEstimateFakeUnsignedTx({
  accountAddress,
  accountId,
  amount,
  networkId,
  token,
}: {
  accountAddress: string;
  accountId: string;
  amount?: string;
  networkId: string;
  token: IMarketPresetFeeEstimateFakeTxToken;
}): Promise<IUnsignedTxPro | undefined> {
  if (!accountId || !networkId) {
    return undefined;
  }

  const transferInfo = buildMarketPresetFeeEstimateFakeTransferInfo({
    accountAddress,
    amount,
    token,
  });
  if (!transferInfo) {
    return undefined;
  }

  try {
    return await backgroundApiProxy.serviceSend.buildUnsignedTx({
      accountId,
      networkId,
      transfersInfo: [transferInfo],
    });
  } catch {
    return undefined;
  }
}

export async function estimateMarketPresetGasFeeFiatValues({
  accountAddress,
  accountId,
  amount,
  items,
  nativeTokenPrice,
  networkId,
  token,
}: {
  accountAddress: string;
  accountId: string;
  amount?: string;
  items: {
    customPriorityFee?: IMarketPresetPriorityFeeOverride;
    networkFeeLevel?: ESwapNetworkFeeLevel;
  }[];
  nativeTokenPrice?: string | number;
  networkId: string;
  token: IMarketPresetFeeEstimateFakeTxToken;
}) {
  if (!accountId || !networkId || !accountAddress) {
    return items.map(() => undefined);
  }

  if (!items.length) {
    return [];
  }

  try {
    const fakeUnsignedTx = await buildMarketPresetFeeEstimateFakeUnsignedTx({
      accountAddress,
      accountId,
      amount,
      networkId,
      token,
    });
    const estimateFeeParamsResult =
      await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
        networkId,
        accountId,
        encodedTx: fakeUnsignedTx?.encodedTx,
      });
    const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
      ...estimateFeeParamsResult,
      accountAddress,
      accountId,
      gasAccountEnabled: false,
      networkId,
      scenario: 'swap',
      transfersInfo: fakeUnsignedTx?.transfersInfo,
    });
    const fallbackNativeTokenPrice = buildNativeTokenPrice(nativeTokenPrice);
    const gasCommon = {
      ...gasRes.common,
      nativeTokenPrice:
        new BigNumber(gasRes.common.nativeTokenPrice ?? 0).gt(0) ||
        !fallbackNativeTokenPrice
          ? gasRes.common.nativeTokenPrice
          : fallbackNativeTokenPrice,
    };

    return items.map((item) => {
      const baseGasInfo = normalizeMarketPresetGasLimitForDisplay({
        gasInfo: buildGasInfo(gasRes, gasCommon, item.networkFeeLevel),
      });
      const estimateFeeParams =
        estimateFeeParamsResult.estimateFeeParams ??
        buildMarketPresetEstimateFeeParams(baseGasInfo);
      const gasInfo = applyCustomPriorityFeeToGasInfo({
        gasInfo: baseGasInfo,
        customPriorityFee: item.customPriorityFee,
        estimateFeeParams,
      });

      return buildGasFeeFiatValue([
        {
          gasInfo,
          estimateFeeParams,
          txSize: fakeUnsignedTx?.txSize ?? getMarketPresetFeeTxSize(gasInfo),
        },
      ]);
    });
  } catch {
    return items.map(() => undefined);
  }
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
  estimateFeeParams,
  tronResourceRentalInfo,
  useDefaultRpc,
}: {
  accountId: string;
  networkId: string;
  unsignedTxItem: IUnsignedTxPro;
  gasInfo: ISwapGasInfo;
  estimateFeeParams?: IEstimateFeeParams;
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
    estimateFeeParams,
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

  // When estimate-fee confirmed Gas Account sponsorship, attach the quote so the
  // broadcast pays via the sponsor. Mirrors the transaction-confirm page.
  const gasAccountUiState: IGasAccountUiState | undefined =
    gasInfo.gasAccountEligible &&
    gasInfo.payer === 'gasAccount' &&
    gasInfo.gasAccountQuote?.quoteId
      ? {
          payer: gasInfo.payer,
          gasAccountEligible: true,
          gasAccountQuote: gasInfo.gasAccountQuote,
          selectedPayer: 'gasAccount',
          // Same nonce the quote was bound to at estimate-fee time.
          lockedUserNonce:
            typeof updatedUnsignedTxItem.nonce === 'number'
              ? updatedUnsignedTxItem.nonce
              : undefined,
          idempotencyKey: `gas-account:${gasInfo.gasAccountQuote.quoteId}`,
        }
      : undefined;

  const sendTxParams = {
    networkId,
    accountId,
    unsignedTx: updatedUnsignedTxItem,
    signOnly: false as const,
    tronResourceRentalInfo,
    useDefaultRpc,
  };
  let signedTx: Awaited<
    ReturnType<typeof backgroundApiProxy.serviceSend.signAndSendTransaction>
  >;
  try {
    signedTx = await backgroundApiProxy.serviceSend.signAndSendTransaction({
      ...sendTxParams,
      gasAccountUiState,
    });
  } catch (e) {
    // Gas Account Fallback codes (pool exhausted, daily limit, sponsor down):
    // drop the sponsor quote and resend once as user-paid, mirroring the
    // confirm page. Refresh/Hint and non gas-account errors propagate to the UI
    // (useSpeedSwapActions maps them to a sponsor toast). See useSwapBuiltTx.
    const entry = gasAccountUiState
      ? getGasAccountErrorEntry(getGasAccountErrorCode(e))
      : undefined;
    if (entry?.strategy !== EGasAccountErrorStrategy.Fallback) {
      throw e;
    }
    signedTx =
      await backgroundApiProxy.serviceSend.signAndSendTransaction(sendTxParams);
  }

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

  // For sponsored swaps, never reuse the preview gasInfos: re-run estimate-fee
  // right before sending so the broadcast uses a fresh, non-expired
  // gasAccountQuote.quoteId.
  const needFreshGasForSponsor = unsignedTxArr.some(
    (tx) => tx.swapInfo?.swapBuildResData?.result?.gasAccountEnabled,
  );

  if (
    needFreshGasForSponsor ||
    !unsignedTxArr.every((tx) => findGasInfo(gasInfosFinal, tx.encodedTx))
  ) {
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
    const gasInfoEntry = findGasInfo(gasInfosFinal, unsignedTxItem.encodedTx);
    const gasInfo = gasInfoEntry?.gasInfo;
    if (!gasInfo) {
      throw new OneKeyError('gas info not found');
    }

    results.push(
      await updateUnsignedTxAndSendTx({
        accountId,
        networkId,
        unsignedTxItem,
        gasInfo,
        estimateFeeParams: gasInfoEntry.estimateFeeParams,
        tronResourceRentalInfo,
        useDefaultRpc,
      }),
    );
  }

  return results;
}
