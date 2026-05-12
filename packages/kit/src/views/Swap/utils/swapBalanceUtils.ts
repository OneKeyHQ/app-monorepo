import BigNumber from 'bignumber.js';

import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type {
  IQuoteResultFeeOtherFeeInfo,
  ISwapGasInfo,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

type ISwapLatestBalanceCheckParams = {
  token: ISwapToken;
  amount: string;
  accountId?: string;
  accountAddress?: string;
};

export type ISwapLatestBalanceCheckResult =
  | {
      isSufficient: true;
    }
  | {
      isSufficient: false;
      balance: string;
      requiredAmount: string;
      tokenSymbol: string;
    };

type ISwapGasInfoEntry = {
  gasInfo?: ISwapGasInfo;
};

type ISwapNativeBalanceRequirementParams = {
  gasInfos?: ISwapGasInfoEntry[];
  networkId?: string;
  fromToken?: ISwapToken;
  fromAmount?: string;
  otherFeeInfos?: IQuoteResultFeeOtherFeeInfo[];
};

export type ISwapNativeBalanceRequirement = {
  token: ISwapToken;
  amount: string;
  reserveAmount: string;
  includesFromAmount: boolean;
};

function buildNativeTokenFromGasInfo({
  gasInfo,
  networkId,
  fromToken,
}: {
  gasInfo: ISwapGasInfo;
  networkId?: string;
  fromToken?: ISwapToken;
}) {
  if (!gasInfo.common || !networkId) {
    return undefined;
  }

  if (fromToken?.isNative && fromToken.networkId === networkId) {
    return fromToken;
  }

  return {
    networkId,
    contractAddress: '',
    isNative: true,
    symbol: gasInfo.common.nativeSymbol,
    decimals: gasInfo.common.nativeDecimals,
  } as ISwapToken;
}

export function getSwapRequiredNativeBalanceAmount({
  gasInfos,
  networkId,
  fromToken,
  fromAmount,
  otherFeeInfos,
}: ISwapNativeBalanceRequirementParams):
  | ISwapNativeBalanceRequirement
  | undefined {
  if (!gasInfos?.length || !networkId) {
    return undefined;
  }

  let nativeToken: ISwapToken | undefined;
  const networkFeeAmount = gasInfos.reduce((acc, item) => {
    if (!item.gasInfo?.common) {
      return acc;
    }

    nativeToken =
      nativeToken ??
      buildNativeTokenFromGasInfo({
        gasInfo: item.gasInfo,
        networkId,
        fromToken,
      });

    const { totalNative } = calculateFeeForSend({
      feeInfo: item.gasInfo as IFeeInfoUnit,
      nativeTokenPrice: item.gasInfo.common.nativeTokenPrice ?? 0,
    });
    const totalNativeBN = new BigNumber(totalNative);

    if (totalNativeBN.isNaN() || !totalNativeBN.isFinite()) {
      return acc;
    }

    return acc.plus(totalNativeBN);
  }, new BigNumber(0));

  if (!nativeToken) {
    return undefined;
  }

  const fromAmountBN = new BigNumber(fromAmount ?? 0);
  const shouldAddFromAmount = Boolean(
    fromToken?.isNative &&
    fromToken.networkId === nativeToken.networkId &&
    !fromAmountBN.isNaN() &&
    fromAmountBN.isFinite() &&
    fromAmountBN.gt(0),
  );
  const otherNativeFeeAmount = (otherFeeInfos ?? []).reduce((acc, item) => {
    if (
      !item.token?.isNative ||
      item.token.networkId !== nativeToken?.networkId
    ) {
      return acc;
    }

    const amountBN = new BigNumber(item.amount ?? 0);
    if (amountBN.isNaN() || !amountBN.isFinite() || amountBN.lte(0)) {
      return acc;
    }

    return acc.plus(amountBN);
  }, new BigNumber(0));

  const reserveAmount = networkFeeAmount.plus(otherNativeFeeAmount);
  const requiredAmount = shouldAddFromAmount
    ? reserveAmount.plus(fromAmountBN)
    : reserveAmount;

  if (requiredAmount.lte(0)) {
    return undefined;
  }

  return {
    token: nativeToken,
    amount: requiredAmount.toFixed(),
    reserveAmount: reserveAmount.toFixed(),
    includesFromAmount: shouldAddFromAmount,
  };
}

export async function checkSwapLatestBalanceSufficient({
  token,
  amount,
  accountId,
  accountAddress,
}: ISwapLatestBalanceCheckParams): Promise<ISwapLatestBalanceCheckResult> {
  const amountBN = new BigNumber(amount || 0);
  if (
    !token?.networkId ||
    !accountAddress ||
    amountBN.isNaN() ||
    !amountBN.isFinite() ||
    amountBN.lte(0)
  ) {
    return { isSufficient: true };
  }

  try {
    const tokenBalanceInfo =
      await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
        networkId: token.networkId,
        contractAddress: token.contractAddress ?? '',
        accountAddress,
        accountId,
        currency: 'usd',
      });
    if (!tokenBalanceInfo?.length) {
      return { isSufficient: true };
    }

    const balanceBN = new BigNumber(tokenBalanceInfo[0].balanceParsed ?? 0);
    if (balanceBN.isNaN() || !balanceBN.isFinite()) {
      return { isSufficient: true };
    }

    if (amountBN.gt(balanceBN)) {
      return {
        isSufficient: false,
        balance: balanceBN.toFixed(),
        requiredAmount: amountBN.toFixed(),
        tokenSymbol: token.symbol,
      };
    }
  } catch (error) {
    console.error('checkSwapLatestBalanceSufficient error', error);
  }

  return { isSufficient: true };
}
