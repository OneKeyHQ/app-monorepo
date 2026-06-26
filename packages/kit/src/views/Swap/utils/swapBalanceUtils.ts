import BigNumber from 'bignumber.js';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
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

function toFiniteNonNegativeBigNumber(value?: string) {
  const valueBN = new BigNumber(value ?? '');
  if (valueBN.isNaN() || !valueBN.isFinite() || valueBN.lt(0)) {
    return undefined;
  }
  return valueBN;
}

export function getSwapSafeInputBalanceAmount({
  balance,
  fallbackBalance,
  fallbackBalanceMatchesAccount = true,
}: {
  balance?: string;
  fallbackBalance?: string;
  fallbackBalanceMatchesAccount?: boolean;
}) {
  const balanceBN = toFiniteNonNegativeBigNumber(balance);
  if (balanceBN) {
    return balanceBN;
  }

  if (!fallbackBalanceMatchesAccount) {
    return undefined;
  }

  return toFiniteNonNegativeBigNumber(fallbackBalance);
}

async function getSwapTokenBalanceContractAddress(token: ISwapToken) {
  if (!token.isNative || token.contractAddress) {
    return token.contractAddress ?? '';
  }

  try {
    return (
      (await backgroundApiProxy.serviceToken.getNativeTokenAddress({
        networkId: token.networkId,
      })) ?? ''
    );
  } catch {
    return token.contractAddress ?? '';
  }
}

type ISwapGasInfoEntry = {
  gasInfo?: ISwapGasInfo;
  txSize?: number;
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

type IEncodedTxWithOutputs = {
  outputs?: {
    address?: string;
    value?: string | number;
  }[];
};

export type ISwapExactPaymentOutputMismatch = {
  expectedAmount: string;
  actualAmount: string;
  expectedAmountBase: string;
  actualAmountBase: string;
};

function getEncodedTxOutputs(encodedTx?: IEncodedTx) {
  if (!encodedTx || typeof encodedTx !== 'object') {
    return undefined;
  }

  const { outputs } = encodedTx as IEncodedTxWithOutputs;
  if (!Array.isArray(outputs)) {
    return undefined;
  }

  return outputs;
}

export function getSwapExactPaymentOutputMismatch({
  encodedTx,
  transferInfo,
}: {
  encodedTx?: IEncodedTx;
  transferInfo?: ITransferInfo;
}): ISwapExactPaymentOutputMismatch | undefined {
  const outputs = getEncodedTxOutputs(encodedTx);
  const tokenDecimals = transferInfo?.tokenInfo?.decimals;
  if (!outputs || !transferInfo?.to || tokenDecimals === undefined) {
    return undefined;
  }

  const expectedAmountBN = new BigNumber(transferInfo.amount ?? '');
  if (
    expectedAmountBN.isNaN() ||
    !expectedAmountBN.isFinite() ||
    expectedAmountBN.lte(0)
  ) {
    return undefined;
  }

  const expectedAmountBaseBN = expectedAmountBN
    .shiftedBy(tokenDecimals)
    .decimalPlaces(0, BigNumber.ROUND_DOWN);
  if (expectedAmountBaseBN.lte(0)) {
    return undefined;
  }

  const actualAmountBaseBN = outputs.reduce((acc, output) => {
    if (output.address !== transferInfo.to) {
      return acc;
    }

    const outputValueBN = new BigNumber(output.value ?? '');
    if (
      outputValueBN.isNaN() ||
      !outputValueBN.isFinite() ||
      outputValueBN.lte(0)
    ) {
      return acc;
    }

    return acc.plus(outputValueBN);
  }, new BigNumber(0));

  if (actualAmountBaseBN.gte(expectedAmountBaseBN)) {
    return undefined;
  }

  return {
    expectedAmount: expectedAmountBN.toFixed(),
    actualAmount: actualAmountBaseBN.shiftedBy(-tokenDecimals).toFixed(),
    expectedAmountBase: expectedAmountBaseBN.toFixed(),
    actualAmountBase: actualAmountBaseBN.toFixed(),
  };
}

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
      txSize: item.txSize,
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
    const contractAddress = await getSwapTokenBalanceContractAddress(token);
    const tokenBalanceInfo =
      await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
        networkId: token.networkId,
        contractAddress,
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
