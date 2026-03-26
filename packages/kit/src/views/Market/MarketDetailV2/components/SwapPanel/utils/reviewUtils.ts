import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IFetchQuoteResult,
  ISwapPreSwapData,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

type IBuildMarketSwapApproveInfosParams = {
  allowanceResult?: IFetchQuoteResult['allowanceResult'];
  amount: string;
  owner: string;
  fromToken: ISwapToken;
};

type IBuildMarketSwapReviewDataParams = {
  quoteResult: IFetchQuoteResult;
  fromToken: ISwapToken;
  toToken: ISwapToken;
  fromTokenAmount: string;
  slippage: number;
  isHWAndExBatchTransfer?: boolean;
};

type IGetMarketSwapReviewActionTranslationIdParams = {
  isExternalWallet: boolean;
  isHWAndExBatchTransfer: boolean;
  isHwWallet: boolean;
  shouldResetApprove: boolean;
};

function buildApproveInfo(params: {
  allowanceTarget: string;
  amount: string;
  fromToken: ISwapToken;
  owner: string;
  isReset?: boolean;
}): IApproveInfo {
  const { allowanceTarget, amount, fromToken, owner, isReset } = params;

  return {
    owner,
    spender: allowanceTarget,
    amount: isReset ? '0' : amount,
    isMax: !isReset,
    tokenInfo: {
      ...fromToken,
      isNative: !!fromToken.isNative,
      address: fromToken.contractAddress,
      name: fromToken.name ?? fromToken.symbol,
    },
  };
}

export function buildMarketSwapApproveInfos({
  allowanceResult,
  amount,
  owner,
  fromToken,
}: IBuildMarketSwapApproveInfosParams): IApproveInfo[] {
  if (!allowanceResult?.allowanceTarget) {
    return [];
  }

  const approveInfos: IApproveInfo[] = [];

  if (allowanceResult.shouldResetApprove) {
    approveInfos.push(
      buildApproveInfo({
        allowanceTarget: allowanceResult.allowanceTarget,
        amount,
        fromToken,
        owner,
        isReset: true,
      }),
    );
  }

  approveInfos.push(
    buildApproveInfo({
      allowanceTarget: allowanceResult.allowanceTarget,
      amount,
      fromToken,
      owner,
    }),
  );

  return approveInfos;
}

export function buildMarketSwapReviewData({
  quoteResult,
  fromToken,
  toToken,
  fromTokenAmount,
  slippage,
  isHWAndExBatchTransfer,
}: IBuildMarketSwapReviewDataParams): ISwapPreSwapData {
  return {
    fromToken,
    toToken,
    fromTokenAmount: quoteResult.fromAmount ?? fromTokenAmount,
    toTokenAmount: quoteResult.toAmount ?? fromTokenAmount,
    minToAmount: quoteResult.minToAmount,
    providerInfo: quoteResult.info,
    slippage:
      quoteResult.protocol === EProtocolOfExchange.LIMIT ||
      quoteResult.unSupportSlippage
        ? undefined
        : slippage,
    unSupportSlippage: quoteResult.unSupportSlippage ?? false,
    fee: quoteResult.fee,
    supportNetworkFeeLevel: false,
    isHWAndExBatchTransfer,
  };
}

export function createWrappedMarketSwapReviewQuote(params: {
  fromToken: ISwapToken;
  fromTokenAmount: string;
  providerLogo?: string;
  toToken: ISwapToken;
}): IFetchQuoteResult {
  const { fromToken, fromTokenAmount, providerLogo, toToken } = params;

  return {
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider: 'wrapped',
      providerName: 'wrapped',
      providerLogo,
    },
    isWrapped: true,
    fromAmount: fromTokenAmount,
    toAmount: fromTokenAmount,
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    fee: {
      percentageFee: 0,
    },
    unSupportSlippage: true,
  };
}

export function getMarketSwapReviewActionTranslationId({
  isExternalWallet,
  isHWAndExBatchTransfer,
  isHwWallet,
  shouldResetApprove,
}: IGetMarketSwapReviewActionTranslationIdParams): ETranslations {
  if (isHWAndExBatchTransfer) {
    if (isHwWallet) {
      return shouldResetApprove
        ? ETranslations.swap_review_confirm_3_on_device
        : ETranslations.swap_review_confirm_2_on_device;
    }
    if (isExternalWallet) {
      return shouldResetApprove
        ? ETranslations.swap_review_confirm_3_on_wallet
        : ETranslations.swap_review_confirm_2_on_wallet;
    }
  }

  return isHwWallet
    ? ETranslations.global_confirm_on_device
    : ETranslations.global_confirm;
}
