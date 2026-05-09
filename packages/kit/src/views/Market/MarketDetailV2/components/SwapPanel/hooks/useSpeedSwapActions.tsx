import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  OrderBalance,
  hashify,
  normalizeBuyTokenBalance,
  timestamp,
} from '@cowprotocol/contracts';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { cloneDeep } from 'lodash';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import { type ISwapReviewStepTexts } from '@onekeyhq/kit/src/views/Swap/utils/buildSwapReviewState';
import { checkSwapLatestBalanceSufficient } from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils';
import type {
  ISwapReviewAdapter,
  ISwapReviewApproveBroadcastResult,
  ISwapReviewCustomPriorityFee,
  ISwapReviewGasInfoEntry,
  ISwapReviewState,
} from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IApproveInfo,
  IBuildUnsignedTxParams,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapEventAPIStatus } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import {
  EMessageTypesEth,
  ESigningScheme,
} from '@onekeyhq/shared/types/message';
import { wrappedTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapApproveTransaction,
  ISwapNativeTokenReserveGas,
  ISwapToken,
  ISwapTokenBase,
  ISwapTxHistory,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapFetchCancelCause,
  ESwapNetworkFeeLevel,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
  EWrappedType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISendTxBaseParams,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { buildMarketExecutionPayload } from './marketBuildExecutionUtils';
import {
  buildMarketGasInfoFeeInfo,
  estimateMarketApproveGasInfos,
  estimateMarketDirectGasInfos,
  sendMarketDirectUnsignedTxs,
} from './marketDirectSendTx';
import { resolveMarketReviewAllowanceState } from './marketReviewAllowance';
import {
  buildMarketReviewRateDifference,
  buildMarketReviewState,
  shouldAutoContinueMarketResetApprove,
  shouldSkipMarketSignedPrebuild,
} from './marketReviewExecutionUtils';
import {
  buildDefaultMarketSpeedCheckState,
  buildMarketReviewShouldFallback,
  mergeMarketBuildResultWithQuote,
  pickMarketQuoteResultByProvider,
  shouldFetchMarketQuoteFallbackData,
} from './marketSwapBuildUtils';
import {
  areMarketApproveAmountsEqual,
  assertMarketReviewQuoteResult,
  assertMarketSignPreviewInvariant,
  assertMarketSignedBuildInvariant,
  attachMarketOneInchFusionSignature,
  buildMarketApproveInfos,
  buildMarketSwapApprovingTransaction,
  buildWrappedMarketQuoteResult,
  canReuseMarketSigningQuoteResult,
  extractMarketSwapSuccessResult,
  normalizeMarketReviewQuoteResult,
} from './marketSwapReviewUtils';
import { usePaymentTokenPrice } from './usePaymentTokenPrice';
import { ESwapDirection } from './useTradeType';

export type IMarketSwapReviewAdapter = ISwapReviewAdapter;

type IMarketReviewExecutionSnapshot = {
  kind: 'swap' | 'wrap';
  accountAddress: string;
  accountId: string;
  networkId: string;
  shouldFallback: boolean;
  quoteResult: IFetchQuoteResult;
  buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams;
  swapInfo: ISwapTxInfo;
  buildRes?: IFetchBuildTxResponse;
  customPriorityFee?: ISwapReviewCustomPriorityFee;
};

type ICheckSwapLatestBalanceSufficient = (params: {
  token: ISwapToken;
  amount: string;
  accountAddress?: string;
  accountId?: string;
}) => Promise<
  | {
      isSufficient: true;
    }
  | {
      isSufficient: false;
      balance: string;
      requiredAmount: string;
      tokenSymbol: string;
    }
>;

const checkLatestBalanceSufficient =
  checkSwapLatestBalanceSufficient as ICheckSwapLatestBalanceSufficient;

export function buildMarketReviewTokens({
  tradeType,
  fromToken,
  toToken,
  tradeTokenPrice,
}: {
  tradeType: ESwapDirection;
  fromToken: ISwapToken;
  toToken: ISwapToken;
  tradeTokenPrice?: BigNumber;
}) {
  if (!tradeTokenPrice || tradeTokenPrice.isNaN() || !tradeTokenPrice.gt(0)) {
    return { fromToken, toToken };
  }

  const resolvedPrice = tradeTokenPrice.toFixed();

  if (tradeType === ESwapDirection.BUY) {
    return {
      fromToken: {
        ...fromToken,
        price: resolvedPrice,
      },
      toToken,
    };
  }

  return {
    fromToken,
    toToken: {
      ...toToken,
      price: resolvedPrice,
    },
  };
}

export function useSpeedSwapActions(props: {
  marketToken: ISwapToken;
  tradeToken: ISwapTokenBase;
  tradeType: ESwapDirection;
  fromTokenAmount: string;
  provider: string;
  spenderAddress: string;
  slippage: number;
  antiMEV: boolean;
  isCustomRpcUnavailable?: boolean;
  isReviewDialogOpen?: boolean;
  onCloseDialog?: () => void;
}) {
  const {
    marketToken,
    fromTokenAmount,
    tradeToken,
    tradeType,
    provider,
    spenderAddress,
    slippage,
    antiMEV,
    isCustomRpcUnavailable,
    isReviewDialogOpen,
    // onCloseDialog,
  } = props;

  const intl = useIntl();
  const [inAppNotificationAtom, setInAppNotificationAtom] =
    useInAppNotificationAtom();
  const [settingsAtom] = useSettingsPersistAtom();
  const { activeAccount: account } = useActiveAccount({ num: 0 });
  const [shouldApprove, setShouldApprove] = useState(false);
  const [shouldResetApprove, setShouldResetApprove] = useState(false);
  const [speedSwapBuildTxLoading, setSpeedSwapBuildTxLoading] = useState(false);
  const [checkTokenAllowanceLoading, setCheckTokenAllowanceLoading] =
    useState(false);
  const [fetchBalanceLoading, setFetchBalanceLoading] = useState(false);
  const [swapNativeTokenReserveGas, setSwapNativeTokenReserveGas] = useState<
    ISwapNativeTokenReserveGas[]
  >([]);
  const [priceRate, setPriceRate] = useState<
    | {
        rate?: number;
        fromTokenSymbol?: string;
        toTokenSymbol?: string;
        loading?: boolean;
      }
    | undefined
  >(undefined);
  const [balance, setBalance] = useState<BigNumber | undefined>(
    new BigNumber(0),
  );
  const [speedCheckError, setSpeedCheckError] = useState('');
  const [speedCheckLoading, setSpeedCheckLoading] = useState(false);
  const [checkSpenderAddress, setCheckSpenderAddress] = useState('');
  const [isStock, setIsStock] = useState(false);
  const speedCheckRequestIdRef = useRef(0);
  const balanceRequestIdRef = useRef(0);
  const priceRequestIdRef = useRef(0);
  const reviewExecutionSnapshotRef = useRef<
    IMarketReviewExecutionSnapshot | undefined
  >(undefined);
  const defaultMarketSpeedCheckState = useMemo(
    () => buildDefaultMarketSpeedCheckState(),
    [],
  );

  const effectiveSpenderAddress = checkSpenderAddress || spenderAddress;

  const { fromToken, toToken, balanceToken } = useMemo(() => {
    if (tradeType === ESwapDirection.BUY) {
      return {
        fromToken: tradeToken,
        toToken: marketToken,
        balanceToken: tradeToken,
      };
    }
    return {
      fromToken: marketToken,
      toToken: tradeToken,
      balanceToken: marketToken,
    };
  }, [tradeType, marketToken, tradeToken]);
  const tradeTokenPriceKey = `${tradeToken.networkId ?? ''}:${tradeToken.contractAddress ?? ''}`;
  const { price: liveTradeTokenPrice, tokenKey: liveTradeTokenPriceKey } =
    usePaymentTokenPrice(tradeToken, tradeToken.networkId);
  const effectiveTradeTokenPrice = useMemo(() => {
    if (liveTradeTokenPriceKey === tradeTokenPriceKey) {
      return liveTradeTokenPrice ?? new BigNumber(tradeToken.price || 0);
    }

    return new BigNumber(tradeToken.price || 0);
  }, [
    liveTradeTokenPrice,
    liveTradeTokenPriceKey,
    tradeToken.price,
    tradeTokenPriceKey,
  ]);

  // Use atom to get selected derive type from Market Detail page
  const [selectedDeriveType] = useSelectedDeriveTypeAtom();

  const netAccountRes = usePromiseResult(async () => {
    try {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: balanceToken?.networkId ?? '',
        });

      // Prioritize Market Detail page selected derive type over global
      const effectiveDeriveType =
        selectedDeriveType ?? defaultDeriveType ?? 'default';

      const res = await backgroundApiProxy.serviceAccount.getNetworkAccount({
        accountId: account?.indexedAccount?.id
          ? undefined
          : account?.account?.id,
        indexedAccountId: account?.indexedAccount?.id ?? '',
        networkId: balanceToken?.networkId,
        deriveType: effectiveDeriveType,
      });
      return res;
    } catch (_e) {
      return undefined;
    }
  }, [account, balanceToken?.networkId, selectedDeriveType]);

  const marketDeriveInfoRes = usePromiseResult(async () => {
    if (!balanceToken?.networkId) {
      return undefined;
    }

    const defaultDeriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: balanceToken.networkId,
      });

    const effectiveDeriveType =
      selectedDeriveType ??
      defaultDeriveType ??
      account?.deriveType ??
      'default';

    return backgroundApiProxy.serviceNetwork.getDeriveInfoOfNetwork({
      networkId: balanceToken.networkId,
      deriveType: effectiveDeriveType,
    });
  }, [account?.deriveType, balanceToken?.networkId, selectedDeriveType]);

  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: netAccountRes.result?.id ?? '',
    networkId: fromToken.networkId,
  });
  const balanceRefreshToken = useMemo(() => {
    if (
      !balanceToken?.networkId &&
      !balanceToken?.contractAddress &&
      !balanceToken?.symbol
    ) {
      return undefined;
    }

    return {
      networkId: balanceToken?.networkId,
      contractAddress: balanceToken?.contractAddress,
      symbol: balanceToken?.symbol,
      decimals: balanceToken?.decimals,
      logoURI: balanceToken?.logoURI,
      name: balanceToken?.name,
      isNative: balanceToken?.isNative,
    };
  }, [
    balanceToken?.contractAddress,
    balanceToken?.decimals,
    balanceToken?.isNative,
    balanceToken?.logoURI,
    balanceToken?.name,
    balanceToken?.networkId,
    balanceToken?.symbol,
  ]);

  // Listen for derive type changes and re-fetch network account
  useEffect(() => {
    const handleDeriveTypeChanged = () => {
      void netAccountRes.run();
    };
    appEventBus.off(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      handleDeriveTypeChanged,
    );
    appEventBus.on(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      handleDeriveTypeChanged,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        handleDeriveTypeChanged,
      );
    };
  }, [netAccountRes]);

  const fromTokenAmountDebounced = useDebounce(fromTokenAmount, 300, {
    leading: true,
  });

  const buildReviewStepTexts = useCallback(
    (providerName?: string): ISwapReviewStepTexts => ({
      wrap: intl.formatMessage({
        id: ETranslations.swap_page_button_wrap,
      }),
      approveAndSwap: intl.formatMessage({
        id: ETranslations.swap_page_approve_and_swap,
      }),
      approveAndSign: intl.formatMessage({
        id: ETranslations.swap_page_approve_and_sign,
      }),
      revokeApprove: intl.formatMessage(
        {
          id: ETranslations.global_revoke_approve,
        },
        {
          symbol: fromToken.symbol,
        },
      ),
      approveToken: intl.formatMessage(
        {
          id: ETranslations.swap_page_approve_button,
        },
        {
          token: fromToken.symbol,
        },
      ),
      approveTokenWithTarget: intl.formatMessage(
        {
          id: ETranslations.swap_page_approve_button,
        },
        {
          token: fromToken.symbol,
          target: providerName,
        },
      ),
      signAndSubmit: intl.formatMessage({
        id: ETranslations.swap_review_sign_and_submit,
      }),
      sign: intl.formatMessage({
        id: ETranslations.global_sign,
      }),
      confirmSwap: intl.formatMessage({
        id: ETranslations.swap_review_confirm_swap,
      }),
      swap: intl.formatMessage({
        id: ETranslations.global_swap,
      }),
    }),
    [fromToken.symbol, intl],
  );

  const cancelSpeedSwapBuildTx = useCallback(() => {
    setSpeedSwapBuildTxLoading(false);
  }, []);

  const isWrapped = useMemo(
    () => checkWrappedTokenPair({ fromToken, toToken }),
    [fromToken, toToken],
  );

  const persistMarketSwapHistoryItem = useCallback(
    async ({
      swapInfo,
      txHash,
      gasFeeFiatValue,
      gasFeeInNative,
    }: {
      swapInfo: ISwapTxInfo;
      txHash?: string;
      gasFeeFiatValue?: string;
      gasFeeInNative?: string;
    }) => {
      const txNetworkId = swapInfo.sender.token.networkId;
      const buildCtx = swapInfo.swapBuildResData.ctx as
        | {
            cowSwapOrderId?: string;
            oneInchFusionOrderHash?: string;
            changeHeroOrderId?: string;
          }
        | undefined;
      const serviceOrderId =
        swapInfo.swapBuildResData.orderId ??
        swapInfo.swapBuildResData.result?.quoteId;
      const historyOrderId =
        swapInfo.swapBuildResData.swftOrder?.orderId ??
        (txHash
          ? (buildCtx?.cowSwapOrderId ??
            buildCtx?.oneInchFusionOrderHash ??
            buildCtx?.changeHeroOrderId)
          : (serviceOrderId ??
            buildCtx?.cowSwapOrderId ??
            buildCtx?.oneInchFusionOrderHash ??
            buildCtx?.changeHeroOrderId));
      const fromNetworkPreset = Object.values(presetNetworksMap).find(
        (item) => item.id === swapInfo.sender.token.networkId,
      );
      const toNetworkPreset = Object.values(presetNetworksMap).find(
        (item) => item.id === swapInfo.receiver.token.networkId,
      );
      const useOrderId = Boolean(
        (!txHash && historyOrderId) ||
        buildCtx?.cowSwapOrderId ||
        buildCtx?.oneInchFusionOrderHash,
      );

      if (
        swapInfo.protocol === EProtocolOfExchange.SWAP ||
        swapInfo.swapBuildResData.result.isWrapped
      ) {
        const swapHistoryItem: ISwapTxHistory = {
          status: ESwapTxHistoryStatus.PENDING,
          currency: settingsAtom.currencyInfo?.symbol,
          accountInfo: {
            sender: {
              accountId: swapInfo.sender.accountInfo?.accountId,
              networkId: swapInfo.sender.accountInfo?.networkId,
            },
            receiver: {
              accountId: swapInfo.receiver.accountInfo?.accountId,
              networkId: swapInfo.receiver.accountInfo?.networkId,
            },
          },
          baseInfo: {
            toAmount: swapInfo.receiver.amount,
            fromAmount: swapInfo.sender.amount,
            fromToken: swapInfo.sender.token,
            toToken: swapInfo.receiver.token,
            fromNetwork: {
              networkId: fromNetworkPreset?.id ?? '',
              name: fromNetworkPreset?.name ?? '',
              symbol: fromNetworkPreset?.symbol ?? '',
              logoURI: fromNetworkPreset?.logoURI ?? '',
              shortcode: fromNetworkPreset?.shortcode ?? '',
            },
            toNetwork: {
              networkId: toNetworkPreset?.id ?? '',
              name: toNetworkPreset?.name ?? '',
              symbol: toNetworkPreset?.symbol ?? '',
              logoURI: toNetworkPreset?.logoURI ?? '',
              shortcode: toNetworkPreset?.shortcode ?? '',
            },
          },
          txInfo: {
            txId: txHash,
            useOrderId,
            gasFeeFiatValue,
            gasFeeInNative,
            orderId: historyOrderId,
            sender: swapInfo.accountAddress,
            receiver: swapInfo.receivingAddress,
          },
          date: {
            created: Date.now(),
            updated: Date.now(),
          },
          swapInfo: {
            instantRate: swapInfo.swapBuildResData.result?.instantRate ?? '0',
            provider: swapInfo.swapBuildResData.result?.info,
            socketBridgeScanUrl: swapInfo.swapBuildResData.socketBridgeScanUrl,
            oneKeyFee:
              swapInfo.swapBuildResData.result?.fee?.percentageFee ?? 0,
            protocolFee:
              swapInfo.swapBuildResData.result?.fee?.protocolFees ?? 0,
            otherFeeInfos:
              swapInfo.swapBuildResData.result?.fee?.otherFeeInfos ?? [],
            orderId: serviceOrderId,
            supportUrl: swapInfo.swapBuildResData.result?.supportUrl,
            orderSupportUrl: swapInfo.swapBuildResData.result?.orderSupportUrl,
            oneKeyFeeExtraInfo:
              swapInfo.swapBuildResData.result?.oneKeyFeeExtraInfo,
          },
          ctx: swapInfo.swapBuildResData.ctx,
        };
        await backgroundApiProxy.serviceSwap.addSwapHistoryItem(
          swapHistoryItem,
        );

        if (
          txHash &&
          txNetworkId &&
          swapInfo.sender.token.networkId === swapInfo.receiver.token.networkId
        ) {
          void backgroundApiProxy.serviceNotification.blockNotificationForTxId({
            networkId: txNetworkId,
            tx: txHash,
          });
        }
      }

      return {
        orderId: historyOrderId,
      };
    },
    [settingsAtom.currencyInfo?.symbol],
  );

  const handleMarketSwapBuildTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      setSpeedSwapBuildTxLoading(false);

      const swapTxData = data
        .toReversed()
        .find((item) => item.signedTx.swapInfo);
      const result = extractMarketSwapSuccessResult(data);
      const swapInfo = swapTxData?.signedTx.swapInfo;

      if (!swapInfo || !result) {
        return undefined;
      }

      appEventBus.emit(EAppEventBusNames.SwapSpeedBuildTxSuccess, {
        fromToken: swapInfo.sender.token,
        toToken: swapInfo.receiver.token,
        fromAmount: swapInfo.sender.amount,
        toAmount: swapInfo.receiver.amount,
      });

      const historyResult = await persistMarketSwapHistoryItem({
        swapInfo,
        txHash: result.txHash,
        gasFeeFiatValue: result.gasFeeFiatValue,
        gasFeeInNative: result.gasFeeInNative,
      });

      return {
        ...result,
        orderId: historyResult.orderId,
      };
    },
    [persistMarketSwapHistoryItem],
  );

  const handleMarketSignedOrderSuccess = useCallback(
    async ({ swapInfo }: { swapInfo: ISwapTxInfo }) => {
      setSpeedSwapBuildTxLoading(false);

      appEventBus.emit(EAppEventBusNames.SwapSpeedBuildTxSuccess, {
        fromToken: swapInfo.sender.token,
        toToken: swapInfo.receiver.token,
        fromAmount: swapInfo.sender.amount,
        toAmount: swapInfo.receiver.amount,
      });

      return persistMarketSwapHistoryItem({
        swapInfo,
      });
    },
    [persistMarketSwapHistoryItem],
  );

  const matchApproveTransaction = useCallback(
    (
      approvingTransaction?: ISwapApproveTransaction,
      amount?: string,
      currentFromToken?: ISwapTokenBase,
      currentToToken?: ISwapTokenBase,
    ) => {
      return Boolean(
        approvingTransaction &&
        (areMarketApproveAmountsEqual(amount, approvingTransaction.amount) ||
          areMarketApproveAmountsEqual(
            amount,
            approvingTransaction.resetApproveValue,
          )) &&
        equalTokenNoCaseSensitive({
          token1: approvingTransaction.fromToken,
          token2: currentFromToken,
        }) &&
        equalTokenNoCaseSensitive({
          token1: approvingTransaction.toToken,
          token2: currentToToken,
        }),
      );
    },
    [],
  );

  const swapApprovingMatchLoading = useMemo(() => {
    return (
      inAppNotificationAtom.speedSwapApprovingLoading &&
      matchApproveTransaction(
        inAppNotificationAtom.speedSwapApprovingTransaction,
        fromTokenAmount,
        fromToken,
        toToken,
      )
    );
  }, [
    fromTokenAmount,
    fromToken,
    inAppNotificationAtom.speedSwapApprovingLoading,
    inAppNotificationAtom.speedSwapApprovingTransaction,
    matchApproveTransaction,
    toToken,
  ]);

  const buildMarketExecutionFromBuildRes = useCallback(
    async ({
      buildRes,
      quoteResult,
      currentFromToken,
      currentToToken,
      fromAmount,
      userAddress,
      accountId,
    }: {
      buildRes: IFetchBuildTxResponse;
      quoteResult?: IFetchQuoteResult;
      currentFromToken: ISwapToken;
      currentToToken: ISwapToken;
      fromAmount: string;
      userAddress: string;
      accountId: string;
    }) => {
      const buildResFinal = mergeMarketBuildResultWithQuote({
        buildRes,
        quoteResult,
      });
      return buildMarketExecutionPayload({
        accountId,
        buildRes: buildResFinal,
        btcDerivationRestrictionErrorMessage: intl.formatMessage({
          id: ETranslations.feedback_derivation_path_restriction,
        }),
        currentFromToken,
        currentToToken,
        deriveAddressEncoding: marketDeriveInfoRes.result?.addressEncoding,
        fromAmount,
        receivingAddress: userAddress,
        slippage,
        userAddress,
        onBuildOkxSwapEncodedTx: (params) =>
          backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx(params),
        onBuildLMSwapEncodedTx: (params) =>
          backgroundApiProxy.serviceSwap.buildLMSwapEncodedTx(params),
        onBuildInternalDappTx: (params) =>
          backgroundApiProxy.serviceStaking.buildInternalDappTx(params),
      });
    },
    [intl, marketDeriveInfoRes.result?.addressEncoding, slippage],
  );

  const assertLatestFromTokenBalanceSufficient = useCallback(
    async ({
      token,
      amount,
      accountAddress,
      accountId,
    }: {
      token: ISwapToken;
      amount: string;
      accountAddress?: string;
      accountId?: string;
    }) => {
      const checkResult = await checkLatestBalanceSufficient({
        token,
        amount,
        accountAddress,
        accountId,
      });
      if (!checkResult.isSufficient) {
        throw new OneKeyLocalError(
          intl.formatMessage(
            {
              id: ETranslations.swap_page_toast_insufficient_balance_title,
            },
            { token: checkResult.tokenSymbol },
          ),
        );
      }
    },
    [intl],
  );

  const buildSpeedSwapTxData = useCallback(
    async ({
      fromAmount,
      fromToken: currentFromToken,
      toToken: currentToToken,
    }: {
      fromAmount?: string;
      fromToken?: ISwapToken;
      toToken?: ISwapToken;
    } = {}) => {
      const amount = fromAmount ?? fromTokenAmountDebounced;
      const fromTokenFinal = currentFromToken ?? fromToken;
      const toTokenFinal = currentToToken ?? toToken;
      const userAddress = netAccountRes.result?.addressDetail.address ?? '';

      if (!amount || !userAddress || !netAccountRes.result?.id) {
        throw new OneKeyLocalError(
          'Market swap review requires account and amount.',
        );
      }

      await assertLatestFromTokenBalanceSufficient({
        token: fromTokenFinal,
        amount,
        accountAddress: userAddress,
        accountId: netAccountRes.result.id,
      });

      setSpeedSwapBuildTxLoading(true);
      try {
        if (isStock) {
          const quoteResult =
            await backgroundApiProxy.serviceSwap.fetchSpeedMarketQuote({
              fromToken: fromTokenFinal,
              toToken: toTokenFinal,
              fromTokenAmount: amount,
              userAddress,
              receivingAddress: userAddress,
              slippagePercentage: slippage,
              accountId: netAccountRes.result.id,
            });

          if (!quoteResult?.swapShouldSignedData) {
            throw new OneKeyLocalError(
              quoteResult?.errorMessage ??
                'Market stock quote sign payload missing.',
            );
          }

          const reviewBuildRes: IFetchBuildTxResponse = {
            ...(quoteResult.quoteId ? { orderId: quoteResult.quoteId } : {}),
            result: {
              ...quoteResult,
              slippage: quoteResult.slippage ?? slippage,
            },
          };

          const swapInfo: ISwapTxInfo = {
            protocol: EProtocolOfExchange.SWAP,
            sender: {
              amount: quoteResult.fromAmount ?? amount,
              token: fromTokenFinal,
              accountInfo: {
                accountId: netAccountRes.result.id,
                networkId: fromTokenFinal.networkId,
              },
            },
            receiver: {
              amount: quoteResult.toAmount ?? '0',
              token: toTokenFinal,
              accountInfo: {
                accountId: netAccountRes.result.id,
                networkId: toTokenFinal.networkId,
              },
            },
            accountAddress: userAddress,
            receivingAddress: userAddress,
            swapBuildResData: reviewBuildRes,
          };

          return {
            buildRes: reviewBuildRes,
            encodedTx: undefined,
            transferInfo: undefined,
            swapInfo,
            userAddress,
          };
        }

        const buildRes =
          await backgroundApiProxy.serviceSwap.fetchBuildSpeedSwapTx({
            fromToken: fromTokenFinal,
            toToken: toTokenFinal,
            fromTokenAmount: amount,
            provider,
            userAddress,
            receivingAddress: userAddress,
            slippagePercentage: slippage,
            accountId: netAccountRes.result.id,
            protocol: EProtocolOfExchange.SWAP,
            kind: ESwapQuoteKind.SELL,
          });

        if (!buildRes) {
          throw new OneKeyLocalError('Market swap review build failed.');
        }

        let quoteResultForBuild: IFetchQuoteResult | undefined;
        if (shouldFetchMarketQuoteFallbackData(buildRes)) {
          const quotes =
            await backgroundApiProxy.serviceSwap.fetchSpeedSwapQuote({
              fromToken: fromTokenFinal,
              toToken: toTokenFinal,
              fromTokenAmount: amount,
              userAddress,
              receivingAddress: userAddress,
              slippagePercentage: slippage,
              autoSlippage: false,
              accountId: netAccountRes.result.id,
              kind: ESwapQuoteKind.SELL,
              protocol: ESwapTabSwitchType.SWAP,
            });
          quoteResultForBuild = pickMarketQuoteResultByProvider({
            quotes,
            provider: buildRes.result.info.provider,
            providerName: buildRes.result.info.providerName,
          });
        }
        const buildResFinal = mergeMarketBuildResultWithQuote({
          buildRes,
          quoteResult: quoteResultForBuild,
        });

        const { encodedTx, transferInfo, swapInfo } =
          await buildMarketExecutionFromBuildRes({
            buildRes: buildResFinal,
            quoteResult: quoteResultForBuild,
            currentFromToken: fromTokenFinal,
            currentToToken: toTokenFinal,
            fromAmount: amount,
            userAddress,
            accountId: netAccountRes.result.id,
          });

        return {
          buildRes: buildResFinal,
          encodedTx,
          transferInfo,
          swapInfo,
          userAddress,
        };
      } finally {
        setSpeedSwapBuildTxLoading(false);
      }
    },
    [
      isStock,
      fromTokenAmountDebounced,
      fromToken,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      provider,
      slippage,
      toToken,
      buildMarketExecutionFromBuildRes,
      assertLatestFromTokenBalanceSufficient,
    ],
  );

  const buildWrappedSwapData = useCallback(
    ({
      fromAmount,
      fromToken: currentFromToken,
      toToken: currentToToken,
    }: {
      fromAmount?: string;
      fromToken?: ISwapToken;
      toToken?: ISwapToken;
    } = {}) => {
      const amount = fromAmount ?? fromTokenAmountDebounced;
      const fromTokenFinal = currentFromToken ?? fromToken;
      const toTokenFinal = currentToToken ?? toToken;
      const userAddress = netAccountRes.result?.addressDetail.address ?? '';

      if (!amount || !userAddress || !netAccountRes.result?.id) {
        throw new OneKeyLocalError(
          'Market wrap review requires account and amount.',
        );
      }

      const wrappedType = fromTokenFinal.isNative
        ? EWrappedType.DEPOSIT
        : EWrappedType.WITHDRAW;
      const wrappedInfo: IWrappedInfo = {
        from: userAddress,
        type: wrappedType,
        contract:
          wrappedType === EWrappedType.WITHDRAW
            ? fromTokenFinal.contractAddress
            : toTokenFinal.contractAddress,
        amount,
      };
      const quoteResult = buildWrappedMarketQuoteResult({
        fromToken: fromTokenFinal,
        toToken: toTokenFinal,
        amount,
        providerLogo: wrappedTokens.find(
          (item) => item.networkId === fromTokenFinal.networkId,
        )?.logo,
      });
      const swapInfo: ISwapTxInfo = {
        protocol: EProtocolOfExchange.SWAP,
        sender: {
          amount,
          token: fromTokenFinal,
          accountInfo: {
            accountId: netAccountRes.result.id,
            networkId: fromTokenFinal.networkId,
          },
        },
        receiver: {
          amount,
          token: toTokenFinal,
          accountInfo: {
            accountId: netAccountRes.result.id,
            networkId: toTokenFinal.networkId,
          },
        },
        accountAddress: userAddress,
        receivingAddress: userAddress,
        swapBuildResData: {
          orderId: stringUtils.generateUUID(),
          result: quoteResult,
        },
      };

      return {
        quoteResult,
        wrappedInfo,
        swapInfo,
      };
    },
    [
      fromTokenAmountDebounced,
      fromToken,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      toToken,
    ],
  );

  const logMarketCreateOrder = useCallback(
    ({
      buildRes,
      amount,
      userAddress,
      status,
    }: {
      buildRes: IFetchBuildTxResponse;
      amount: string;
      userAddress: string;
      status: ESwapEventAPIStatus;
    }) => {
      defaultLogger.swap.createSwapOrder.swapCreateOrder({
        fromTokenAmount: amount,
        fromAddress: userAddress,
        toAddress: userAddress,
        toTokenAmount: buildRes.result?.toAmount ?? '',
        status,
        swapProvider: buildRes.result?.info.provider ?? '',
        swapProviderName: buildRes.result?.info.providerName ?? '',
        swapType: ESwapTabSwitchType.SWAP,
        slippage: slippage.toString(),
        sourceChain: fromToken.networkId ?? '',
        receivedChain: toToken.networkId ?? '',
        sourceTokenSymbol: fromToken.symbol ?? '',
        receivedTokenSymbol: toToken.symbol ?? '',
        feeType: buildRes.result?.fee?.percentageFee?.toString() ?? '0',
        router: JSON.stringify(buildRes.result?.routesData ?? ''),
        isFirstTime: settingsAtom.isFirstTimeSwap,
        createFrom: 'marketDex',
      });
    },
    [
      fromToken.networkId,
      fromToken.symbol,
      settingsAtom.isFirstTimeSwap,
      slippage,
      toToken.networkId,
      toToken.symbol,
    ],
  );

  const buildMarketApproveUnsignedTxArr = useCallback(
    async ({
      approveInfos,
      accountId,
      networkId,
    }: {
      approveInfos?: IApproveInfo[];
      accountId: string;
      networkId: string;
    }) => {
      if (!accountId || !networkId || !approveInfos?.length) {
        return undefined;
      }

      const unsignedTxArr = [];
      let prevNonce: number | undefined;

      for (const approveInfo of approveInfos) {
        const unsignedTx =
          await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
            networkId,
            accountId,
            approveInfo,
            prevNonce,
            isInternalSwap: true,
            disableMev: !antiMEV,
          });
        prevNonce = unsignedTx.nonce;
        unsignedTxArr.push(unsignedTx);
      }

      return unsignedTxArr;
    },
    [antiMEV],
  );

  const buildMarketReviewStateFromSnapshot = useCallback(
    async (
      snapshot: IMarketReviewExecutionSnapshot,
      networkFeeLevel: ESwapNetworkFeeLevel = ESwapNetworkFeeLevel.MEDIUM,
      customPriorityFee?: ISwapReviewCustomPriorityFee,
    ) => {
      const effectiveCustomPriorityFee =
        customPriorityFee ?? snapshot.customPriorityFee;
      const nextReviewState = buildMarketReviewState({
        accountId: snapshot.accountId,
        networkId: snapshot.networkId,
        fromToken: snapshot.swapInfo.sender.token,
        toToken: snapshot.swapInfo.receiver.token,
        fromTokenAmount:
          snapshot.quoteResult.fromAmount ?? snapshot.swapInfo.sender.amount,
        toTokenAmount:
          snapshot.quoteResult.toAmount ?? snapshot.swapInfo.receiver.amount,
        quoteResult: snapshot.quoteResult,
        shouldFallback: snapshot.shouldFallback,
        slippage,
        rateDifference: buildMarketReviewRateDifference({
          quoteResult: snapshot.quoteResult,
          swapInfo: snapshot.swapInfo,
        }),
        texts: buildReviewStepTexts(snapshot.quoteResult.info.providerName),
      });

      let netWorkFee: ISwapReviewState['preSwapData']['netWorkFee'];
      try {
        const approveUnsignedTxArr = await buildMarketApproveUnsignedTxArr({
          approveInfos: buildMarketApproveInfos({
            fromUserAddress: snapshot.accountAddress,
            quoteResult: snapshot.quoteResult,
          }),
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
        });
        if (
          snapshot.quoteResult.swapShouldSignedData &&
          approveUnsignedTxArr?.length
        ) {
          const feeState = await estimateMarketApproveGasInfos({
            accountAddress: snapshot.accountAddress,
            accountId: snapshot.accountId,
            networkId: snapshot.networkId,
            approveUnsignedTxArr,
            networkFeeLevel,
            customPriorityFee: effectiveCustomPriorityFee,
          });

          netWorkFee = {
            gasInfos: feeState.gasInfos,
            gasFeeFiatValue: feeState.gasFeeFiatValue,
          };
        } else if (
          shouldSkipMarketSignedPrebuild({
            quoteResult: snapshot.quoteResult,
            approveUnsignedTxCount: approveUnsignedTxArr?.length,
          })
        ) {
          netWorkFee = undefined;
        } else {
          const feeState = await estimateMarketDirectGasInfos({
            accountAddress: snapshot.accountAddress,
            accountId: snapshot.accountId,
            networkId: snapshot.networkId,
            buildUnsignedParams: snapshot.buildUnsignedParams,
            approveUnsignedTxArr,
            networkFeeLevel,
            customPriorityFee: effectiveCustomPriorityFee,
          });

          if (
            !snapshot.buildUnsignedParams.encodedTx &&
            feeState.preparedUnsignedTx.encodedTx
          ) {
            snapshot.buildUnsignedParams = {
              ...snapshot.buildUnsignedParams,
              encodedTx: feeState.preparedUnsignedTx.encodedTx,
            };
          }

          netWorkFee = {
            gasInfos: feeState.gasInfos,
            gasFeeFiatValue: feeState.gasFeeFiatValue,
          };
        }
      } catch {
        netWorkFee = undefined;
      }

      return {
        steps: nextReviewState.steps,
        preSwapData: {
          ...nextReviewState.preSwapData,
          swapBuildResultData: {
            swapInfo: snapshot.swapInfo,
            encodedTx: snapshot.buildUnsignedParams.encodedTx,
            transferInfo: snapshot.buildUnsignedParams.transfersInfo?.[0],
          },
          netWorkFee,
        },
        quoteResult: snapshot.quoteResult,
      };
    },
    [buildMarketApproveUnsignedTxArr, buildReviewStepTexts, slippage],
  );

  const prepareMarketSwapReview = useCallback<
    IMarketSwapReviewAdapter['prepareReview']
  >(
    async ({
      fromAmount,
      fromToken: currentFromToken,
      toToken: currentToToken,
      isWrap,
      quoteResult,
      networkFeeLevel = ESwapNetworkFeeLevel.MEDIUM,
      customPriorityFee,
    } = {}) => {
      if (quoteResult && reviewExecutionSnapshotRef.current) {
        return buildMarketReviewStateFromSnapshot(
          reviewExecutionSnapshotRef.current,
          networkFeeLevel,
          customPriorityFee,
        );
      }

      const amount = fromAmount ?? fromTokenAmountDebounced;
      const fromTokenFinal = currentFromToken ?? fromToken;
      const toTokenFinal = currentToToken ?? toToken;
      const { fromToken: reviewFromToken, toToken: reviewToToken } =
        buildMarketReviewTokens({
          tradeType,
          fromToken: fromTokenFinal,
          toToken: toTokenFinal,
          tradeTokenPrice: effectiveTradeTokenPrice,
        });

      if (isWrap || isWrapped) {
        const shouldFallback = buildMarketReviewShouldFallback({
          networkId: reviewFromToken.networkId,
          isCustomRpcUnavailable,
        });
        const {
          quoteResult: wrappedQuoteResult,
          wrappedInfo,
          swapInfo,
        } = buildWrappedSwapData({
          fromAmount: amount,
          fromToken: reviewFromToken,
          toToken: reviewToToken,
        });
        reviewExecutionSnapshotRef.current = {
          kind: 'wrap',
          accountAddress: swapInfo.accountAddress,
          accountId: netAccountRes.result?.id ?? '',
          networkId: reviewFromToken.networkId,
          shouldFallback,
          quoteResult: wrappedQuoteResult,
          buildUnsignedParams: {
            networkId: reviewFromToken.networkId,
            accountId: netAccountRes.result?.id ?? '',
            wrappedInfo,
            swapInfo,
            isInternalSwap: true,
            disableMev: !antiMEV,
          } as ISendTxBaseParams & IBuildUnsignedTxParams,
          swapInfo,
          customPriorityFee,
        };

        return buildMarketReviewStateFromSnapshot(
          reviewExecutionSnapshotRef.current,
          networkFeeLevel,
          customPriorityFee,
        );
      }

      const currentSpenderAddress = effectiveSpenderAddress;
      const [
        { buildRes, encodedTx, transferInfo, swapInfo, userAddress },
        allowanceState,
      ] = await Promise.all([
        buildSpeedSwapTxData({
          fromAmount: amount,
          fromToken: reviewFromToken,
          toToken: reviewToToken,
        }),
        resolveMarketReviewAllowanceState({
          amount,
          currentState: {
            allowanceTarget: currentSpenderAddress,
            shouldApprove,
            shouldResetApprove,
          },
          isWrapped,
          spenderAddress: currentSpenderAddress,
          token: reviewFromToken,
          walletAddress: netAccountRes.result?.addressDetail.address,
        }),
      ]);
      setShouldApprove(allowanceState.shouldApprove);
      setShouldResetApprove(allowanceState.shouldResetApprove);
      if (allowanceState.allowanceTarget !== currentSpenderAddress) {
        setCheckSpenderAddress(allowanceState.allowanceTarget ?? '');
      }
      const normalizedQuoteResult = assertMarketReviewQuoteResult(
        normalizeMarketReviewQuoteResult({
          quoteResult: {
            ...buildRes.result,
            slippage: buildRes.result.slippage ?? slippage,
          },
          shouldApprove: allowanceState.shouldApprove,
          shouldResetApprove: allowanceState.shouldResetApprove,
          spenderAddress:
            allowanceState.allowanceTarget ?? currentSpenderAddress,
          amount,
        }),
      );
      const shouldFallback = buildMarketReviewShouldFallback({
        networkId: reviewFromToken.networkId,
        isCustomRpcUnavailable,
      });
      reviewExecutionSnapshotRef.current = {
        kind: 'swap',
        accountAddress: userAddress,
        accountId: netAccountRes.result?.id ?? '',
        networkId: reviewFromToken.networkId,
        shouldFallback,
        quoteResult: normalizedQuoteResult,
        buildUnsignedParams: {
          networkId: reviewFromToken.networkId,
          accountId: netAccountRes.result?.id ?? '',
          transfersInfo: transferInfo ? [transferInfo] : undefined,
          encodedTx,
          swapInfo,
          isInternalSwap: true,
          disableMev: !antiMEV,
        } as ISendTxBaseParams & IBuildUnsignedTxParams,
        swapInfo,
        buildRes,
        customPriorityFee,
      };

      return buildMarketReviewStateFromSnapshot(
        reviewExecutionSnapshotRef.current,
        networkFeeLevel,
        customPriorityFee,
      );
    },
    [
      antiMEV,
      buildMarketReviewStateFromSnapshot,
      buildSpeedSwapTxData,
      buildWrappedSwapData,
      effectiveSpenderAddress,
      fromToken,
      fromTokenAmountDebounced,
      isCustomRpcUnavailable,
      isWrapped,
      netAccountRes.result?.id,
      netAccountRes.result?.addressDetail.address,
      shouldApprove,
      shouldResetApprove,
      slippage,
      effectiveTradeTokenPrice,
      tradeType,
      toToken,
    ],
  );

  const checkTokenApproveAllowance = useCallback(
    async (amount: string, overrideSpenderAddress?: string) => {
      const spender = overrideSpenderAddress || effectiveSpenderAddress;
      const amountBN = new BigNumber(amount || 0);
      try {
        if (
          !spender ||
          netAccountRes.result?.addressDetail.networkId !==
            fromToken.networkId ||
          !netAccountRes.result?.addressDetail.address ||
          amountBN.isZero() ||
          amountBN.isNaN() ||
          fromToken.isNative ||
          !fromToken.contractAddress ||
          isWrapped
        ) {
          setShouldApprove(false);
          setShouldResetApprove(false);
          return;
        }
        setCheckTokenAllowanceLoading(true);

        const userAddress = netAccountRes.result?.addressDetail.address ?? '';

        const fetchApproveAllowanceParams = {
          networkId: fromToken.networkId,
          tokenAddress: fromToken.contractAddress,
          spenderAddress: spender,
          walletAddress: userAddress,
          amount,
        };

        const approveRes =
          await backgroundApiProxy.serviceSwap.fetchApproveAllowance(
            fetchApproveAllowanceParams,
          );

        setShouldApprove(!approveRes.isApproved);
        setShouldResetApprove(!!approveRes.shouldResetApprove);
        setCheckTokenAllowanceLoading(false);
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e.cause !== ESwapFetchCancelCause.SWAP_APPROVE_ALLOWANCE_CANCEL) {
          setCheckTokenAllowanceLoading(false);
        }
      }
    },
    [
      fromToken.isNative,
      fromToken.contractAddress,
      fromToken.networkId,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.addressDetail.networkId,
      effectiveSpenderAddress,
      isWrapped,
    ],
  );

  const isUserCancelledError = useCallback((error: unknown) => {
    const normalizedError = error as
      | {
          code?: number;
          key?: string;
          message?: string;
        }
      | undefined;

    return (
      normalizedError?.key === 'global.cancel' ||
      normalizedError?.code === 803 ||
      normalizedError?.code === -99_999 ||
      normalizedError?.message?.toLowerCase().includes('reject') === true
    );
  }, []);

  const requireReviewExecutionSnapshot = useCallback(
    (kind?: IMarketReviewExecutionSnapshot['kind']) => {
      const snapshot = reviewExecutionSnapshotRef.current;

      if (!snapshot) {
        throw new OneKeyLocalError('Market review snapshot missing.');
      }

      if (kind && snapshot.kind !== kind) {
        throw new OneKeyLocalError('Market review snapshot type mismatch.');
      }

      return snapshot;
    },
    [],
  );

  const openMarketFallbackTxConfirm = useCallback(
    async ({
      accountAddress,
      accountId,
      buildUnsignedParams,
      networkFeeLevel,
      networkId,
      customPriorityFee,
      approvesInfo,
      onSuccess,
      onCancel,
    }: {
      accountAddress?: string;
      accountId?: string;
      buildUnsignedParams: IMarketReviewExecutionSnapshot['buildUnsignedParams'];
      networkFeeLevel?: ESwapNetworkFeeLevel;
      networkId?: string;
      customPriorityFee?: ISwapReviewCustomPriorityFee;
      approvesInfo?: IApproveInfo[];
      onSuccess?: (data: ISendTxOnSuccessData[]) => void;
      onCancel?: () => void;
    }) => {
      let feeInfo: IFeeInfoUnit | undefined;
      let feeInfos: IFeeInfoUnit[] | undefined;
      let txConfirmBuildUnsignedParams = buildUnsignedParams;
      const isApproveOnlyTx =
        approvesInfo?.length === 1 &&
        !buildUnsignedParams.encodedTx &&
        !buildUnsignedParams.transfersInfo?.length &&
        !buildUnsignedParams.swapInfo;
      const canAttachPresetFeeInfo =
        Boolean(accountAddress && accountId && networkId) &&
        Boolean(networkFeeLevel || customPriorityFee);

      if (canAttachPresetFeeInfo) {
        try {
          if (approvesInfo?.length && !isApproveOnlyTx) {
            const approveUnsignedTxArr = await buildMarketApproveUnsignedTxArr({
              approveInfos: approvesInfo,
              accountId: accountId as string,
              networkId: networkId as string,
            });

            if (approveUnsignedTxArr?.length) {
              const feeState = await estimateMarketDirectGasInfos({
                accountAddress: accountAddress as string,
                accountId: accountId as string,
                networkId: networkId as string,
                buildUnsignedParams,
                approveUnsignedTxArr,
                networkFeeLevel,
                customPriorityFee,
              });

              if (
                !buildUnsignedParams.encodedTx &&
                feeState.preparedUnsignedTx.encodedTx
              ) {
                txConfirmBuildUnsignedParams = {
                  ...buildUnsignedParams,
                  encodedTx: feeState.preparedUnsignedTx.encodedTx,
                };
              }

              const nextFeeInfos = feeState.gasInfos.map((item) =>
                buildMarketGasInfoFeeInfo(item.gasInfo),
              );
              if (
                nextFeeInfos.length === approveUnsignedTxArr.length + 1 &&
                nextFeeInfos.every((item) => item.gas || item.gasEIP1559)
              ) {
                feeInfos = nextFeeInfos;
              }
            }
          } else {
            const feeState = await estimateMarketDirectGasInfos({
              accountAddress: accountAddress as string,
              accountId: accountId as string,
              networkId: networkId as string,
              buildUnsignedParams,
              networkFeeLevel,
              customPriorityFee,
            });
            const gasInfo =
              feeState.gasInfos[feeState.gasInfos.length - 1]?.gasInfo;
            feeInfo = gasInfo ? buildMarketGasInfoFeeInfo(gasInfo) : undefined;
          }
        } catch {
          feeInfo = undefined;
          feeInfos = undefined;
        }
      }

      const lockFeeEditor = Boolean(feeInfo || feeInfos?.length);

      await navigationToTxConfirm({
        wrappedInfo: txConfirmBuildUnsignedParams.wrappedInfo,
        transfersInfo: txConfirmBuildUnsignedParams.transfersInfo,
        encodedTx: txConfirmBuildUnsignedParams.encodedTx,
        swapInfo: txConfirmBuildUnsignedParams.swapInfo,
        approvesInfo,
        feeInfo,
        feeInfos,
        useFeeInTx: lockFeeEditor ? true : undefined,
        feeInfoEditable: lockFeeEditor ? false : undefined,
        isInternalSwap: true,
        disableMev: txConfirmBuildUnsignedParams.disableMev,
        onSuccess,
        onCancel,
      });
    },
    [buildMarketApproveUnsignedTxArr, navigationToTxConfirm],
  );

  const signMarketReviewQuoteResult = useCallback(
    async ({
      quoteResult,
      accountId,
      networkId,
      accountAddress,
      receivingAddress,
    }: {
      quoteResult: IFetchQuoteResult;
      accountId: string;
      networkId: string;
      accountAddress: string;
      receivingAddress: string;
    }) => {
      const signedQuoteResult = cloneDeep(quoteResult);
      const signPayload = signedQuoteResult.swapShouldSignedData;

      if (!signPayload) {
        throw new OneKeyLocalError('Market sign payload missing.');
      }

      const {
        unSignedInfo,
        unSignedMessage,
        unSignedData,
        oneInchFusionOrder,
      } = signPayload;

      if (
        (unSignedMessage || unSignedData) &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        signedQuoteResult.quoteResultCtx?.cowSwapUnSignedOrder
      ) {
        const unSignedOrder: {
          sellTokenBalance: string;
          buyTokenBalance: string;
          validTo: number;
          appData: string;
          receiver: string;
          buyAmount: string;
          sellAmount: string;
          partiallyFillable: boolean;
        } =
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          signedQuoteResult.quoteResultCtx.cowSwapUnSignedOrder;

        unSignedOrder.receiver = receivingAddress;
        let dataMessage = unSignedMessage;

        if (!dataMessage && unSignedData) {
          const populated = await ethers.utils._TypedDataEncoder.resolveNames(
            unSignedData.domain,
            unSignedData.types,
            {
              ...unSignedOrder,
              sellTokenBalance:
                (unSignedOrder.sellTokenBalance as OrderBalance) ??
                OrderBalance.ERC20,
              buyTokenBalance: normalizeBuyTokenBalance(
                unSignedOrder.buyTokenBalance as OrderBalance,
              ),
              validTo: timestamp(unSignedOrder.validTo),
              appData: hashify(unSignedOrder.appData),
            },
            async (value: string) => value,
          );

          dataMessage = JSON.stringify(
            ethers.utils._TypedDataEncoder.getPayload(
              populated.domain,
              unSignedData.types,
              populated.value,
            ),
          );
        }

        if (!dataMessage) {
          throw new OneKeyError('sign message failed');
        }

        const signature = await backgroundApiProxy.serviceSend.signMessage({
          unsignedMessage: {
            type: unSignedInfo.signedType ?? EMessageTypesEth.TYPED_DATA_V4,
            message: dataMessage,
            payload: [accountAddress.toLowerCase(), dataMessage],
          },
          networkId,
          accountId,
        });

        if (!signature) {
          throw new OneKeyError('sign message failed');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        signedQuoteResult.quoteResultCtx.cowSwapUnSignedOrder = unSignedOrder;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        signedQuoteResult.quoteResultCtx.signedResult = {
          signature,
          signingScheme: ESigningScheme.EIP712,
        };

        return signedQuoteResult;
      }

      if (oneInchFusionOrder) {
        if (oneInchFusionOrder.makerAddress && oneInchFusionOrder.typedData) {
          const dataMessage = JSON.stringify(oneInchFusionOrder.typedData);
          const signature = await backgroundApiProxy.serviceSend.signMessage({
            unsignedMessage: {
              type: unSignedInfo.signedType ?? EMessageTypesEth.TYPED_DATA_V4,
              message: dataMessage,
              payload: [accountAddress.toLowerCase(), dataMessage],
            },
            networkId,
            accountId,
          });

          if (!signature) {
            throw new OneKeyError('sign message failed');
          }

          return attachMarketOneInchFusionSignature({
            quoteResult: signedQuoteResult,
            signature,
          });
        }
      }

      throw new OneKeyLocalError('Market sign payload is not supported.');
    },
    [],
  );

  const refreshMarketSigningQuoteResult = useCallback(
    async ({
      snapshot,
    }: {
      snapshot: IMarketReviewExecutionSnapshot;
    }): Promise<IFetchQuoteResult> => {
      if (canReuseMarketSigningQuoteResult(snapshot.quoteResult)) {
        return snapshot.quoteResult;
      }

      if (!isStock) {
        return snapshot.quoteResult;
      }

      const freshQuoteResult =
        await backgroundApiProxy.serviceSwap.fetchSpeedMarketQuote({
          fromToken: snapshot.swapInfo.sender.token,
          toToken: snapshot.swapInfo.receiver.token,
          fromTokenAmount: snapshot.swapInfo.sender.amount,
          userAddress: snapshot.accountAddress,
          receivingAddress: snapshot.swapInfo.receivingAddress,
          slippagePercentage: snapshot.quoteResult.slippage ?? slippage,
          accountId: snapshot.accountId,
        });

      if (!freshQuoteResult?.swapShouldSignedData) {
        throw new OneKeyLocalError(
          freshQuoteResult?.errorMessage ??
            'Market stock quote sign payload missing.',
        );
      }

      return assertMarketSignPreviewInvariant({
        reviewedQuoteResult: snapshot.quoteResult,
        signingQuoteResult: {
          ...snapshot.quoteResult,
          ...freshQuoteResult,
          allowanceResult: snapshot.quoteResult.allowanceResult,
          slippage:
            freshQuoteResult.slippage ??
            snapshot.quoteResult.slippage ??
            slippage,
        },
      });
    },
    [isStock, slippage],
  );

  const handleMarketApproveTxSuccess = useCallback(
    ({
      approveInfo,
      approvingTransaction,
      data,
      isResetApprove,
      networkId,
      onBroadcast,
    }: {
      approveInfo: IApproveInfo;
      approvingTransaction: ISwapApproveTransaction;
      data: ISendTxOnSuccessData[];
      isResetApprove?: boolean;
      networkId: string;
      onBroadcast?: (result: ISwapReviewApproveBroadcastResult) => void;
    }) => {
      const txId = data[0]?.signedTx.txid;
      const approveAmount = data[0]?.approveInfo?.amount ?? approveInfo.amount;

      if (!txId) {
        return;
      }

      if (!isResetApprove) {
        void backgroundApiProxy.serviceNotification.blockNotificationForTxId({
          networkId,
          tx: txId,
        });
      }

      setInAppNotificationAtom((prev) => {
        return {
          ...prev,
          speedSwapApprovingTransaction: {
            ...(prev.speedSwapApprovingTransaction ?? approvingTransaction),
            txId,
            amount: approveAmount,
            resetApproveIsMax: !!data[0]?.approveInfo?.isMax,
          },
        };
      });

      onBroadcast?.({
        txHash: txId,
        amount: approveAmount,
      });
    },
    [setInAppNotificationAtom],
  );

  const cancelMarketApproveTx = useCallback(() => {
    setInAppNotificationAtom((prev) => {
      if (!prev.speedSwapApprovingTransaction) {
        return prev;
      }

      return {
        ...prev,
        speedSwapApprovingTransaction: {
          ...prev.speedSwapApprovingTransaction,
          status: ESwapApproveTransactionStatus.CANCEL,
        },
      };
    });
  }, [setInAppNotificationAtom]);

  const startMarketApproveTx = useCallback(
    async ({
      accountAddress,
      accountId,
      networkId,
      approveInfo,
      approvingTransaction,
      gasInfos,
      networkFeeLevel,
      customPriorityFee,
      onBroadcast,
      onCancel,
    }: {
      accountAddress: string;
      accountId: string;
      networkId: string;
      approveInfo: IApproveInfo;
      approvingTransaction: ISwapApproveTransaction;
      gasInfos?: ISwapReviewGasInfoEntry[];
      networkFeeLevel?: ESwapNetworkFeeLevel;
      customPriorityFee?: ISwapReviewCustomPriorityFee;
      onBroadcast?: (result: ISwapReviewApproveBroadcastResult) => void;
      onCancel?: () => void;
    }) => {
      try {
        setInAppNotificationAtom((prev) => ({
          ...prev,
          speedSwapApprovingLoading: true,
          speedSwapApprovingTransaction: approvingTransaction,
        }));

        const data = await sendMarketDirectUnsignedTxs({
          accountAddress,
          accountId,
          networkId,
          buildUnsignedParams: {
            accountId,
            networkId,
            approveInfo,
            isInternalSwap: true,
            disableMev: !antiMEV,
          } as ISendTxBaseParams & IBuildUnsignedTxParams,
          gasInfos,
          networkFeeLevel,
          customPriorityFee,
        });
        handleMarketApproveTxSuccess({
          approveInfo,
          approvingTransaction,
          data,
          isResetApprove: approveInfo.amount === '0',
          networkId,
          onBroadcast,
        });
      } catch (error) {
        setInAppNotificationAtom((prev) => ({
          ...prev,
          speedSwapApprovingLoading: false,
        }));
        if (isUserCancelledError(error)) {
          cancelMarketApproveTx();
          onCancel?.();
          return;
        }
        throw error;
      }
    },
    [
      antiMEV,
      cancelMarketApproveTx,
      handleMarketApproveTxSuccess,
      isUserCancelledError,
      setInAppNotificationAtom,
    ],
  );

  const handleMarketResetApprove = useCallback(
    ({ approvedSwapInfo }: { approvedSwapInfo: ISwapApproveTransaction }) => {
      if (
        !shouldAutoContinueMarketResetApprove({
          approvedSwapInfo,
          isReviewDialogOpen,
        })
      ) {
        return;
      }

      const userAddress =
        netAccountRes.result?.addressDetail.address ??
        approvedSwapInfo.useAddress;
      const accountId = netAccountRes.result?.id ?? '';
      if (!userAddress || !accountId || !approvedSwapInfo.resetApproveValue) {
        return;
      }

      const nextApproveInfo: IApproveInfo = {
        owner: userAddress,
        spender: approvedSwapInfo.spenderAddress,
        amount: approvedSwapInfo.resetApproveValue,
        isMax: true,
        tokenInfo: {
          ...approvedSwapInfo.fromToken,
          isNative: !!approvedSwapInfo.fromToken.isNative,
          address: approvedSwapInfo.fromToken.contractAddress,
          name:
            approvedSwapInfo.fromToken.name ??
            approvedSwapInfo.fromToken.symbol,
        },
        swapApproveRes: undefined,
      };

      const nextApprovingTransaction: ISwapApproveTransaction = {
        ...approvedSwapInfo,
        amount: approvedSwapInfo.resetApproveValue,
        resetApproveValue: '0',
        resetApproveIsMax: true,
        status: ESwapApproveTransactionStatus.PENDING,
        txId: undefined,
      };

      void startMarketApproveTx({
        accountAddress: userAddress,
        accountId,
        networkId: approvedSwapInfo.fromToken.networkId,
        approveInfo: nextApproveInfo,
        approvingTransaction: nextApprovingTransaction,
      });
    },
    [
      isReviewDialogOpen,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      startMarketApproveTx,
    ],
  );

  useEffect(() => {
    appEventBus.off(
      EAppEventBusNames.SwapSpeedApprovingReset,
      handleMarketResetApprove,
    );
    appEventBus.on(
      EAppEventBusNames.SwapSpeedApprovingReset,
      handleMarketResetApprove,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapSpeedApprovingReset,
        handleMarketResetApprove,
      );
    };
  }, [handleMarketResetApprove]);

  const sendMarketSwapTx = useCallback<IMarketSwapReviewAdapter['sendSwapTx']>(
    async ({
      approvesInfo,
      gasInfos,
      networkFeeLevel,
      customPriorityFee,
      onBroadcast,
      onCancel,
    } = {}) => {
      const snapshot = requireReviewExecutionSnapshot('swap');
      const effectiveCustomPriorityFee =
        customPriorityFee ?? snapshot.customPriorityFee;

      try {
        await assertLatestFromTokenBalanceSufficient({
          token: snapshot.swapInfo.sender.token,
          amount: snapshot.swapInfo.sender.amount,
          accountAddress: snapshot.accountAddress,
          accountId: snapshot.accountId,
        });

        if (snapshot.shouldFallback) {
          setSpeedSwapBuildTxLoading(true);

          await openMarketFallbackTxConfirm({
            accountAddress: snapshot.accountAddress,
            accountId: snapshot.accountId,
            buildUnsignedParams: snapshot.buildUnsignedParams,
            networkFeeLevel,
            networkId: snapshot.networkId,
            customPriorityFee: effectiveCustomPriorityFee,
            approvesInfo: approvesInfo?.length ? approvesInfo : undefined,
            onSuccess: async (data) => {
              const result = await handleMarketSwapBuildTxSuccess(data);
              if (result) {
                onBroadcast?.(result);
              }
              if (snapshot.buildRes) {
                logMarketCreateOrder({
                  buildRes: snapshot.buildRes,
                  amount: snapshot.swapInfo.sender.amount,
                  userAddress: snapshot.accountAddress,
                  status: ESwapEventAPIStatus.SUCCESS,
                });
              }
            },
            onCancel: () => {
              cancelSpeedSwapBuildTx();
              onCancel?.();
            },
          });

          return;
        }

        const approveUnsignedTxArr = await buildMarketApproveUnsignedTxArr({
          approveInfos: approvesInfo,
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
        });
        const data = await sendMarketDirectUnsignedTxs({
          accountAddress: snapshot.accountAddress,
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
          buildUnsignedParams: snapshot.buildUnsignedParams,
          approveUnsignedTxArr,
          gasInfos,
          networkFeeLevel,
          customPriorityFee: effectiveCustomPriorityFee,
        });
        const result = await handleMarketSwapBuildTxSuccess(data);
        if (result) {
          onBroadcast?.(result);
        }
        logMarketCreateOrder({
          buildRes: snapshot.buildRes as IFetchBuildTxResponse,
          amount: snapshot.swapInfo.sender.amount,
          userAddress: snapshot.accountAddress,
          status: ESwapEventAPIStatus.SUCCESS,
        });
      } catch (error) {
        cancelSpeedSwapBuildTx();
        if (snapshot.buildRes) {
          logMarketCreateOrder({
            buildRes: snapshot.buildRes,
            amount: snapshot.swapInfo.sender.amount,
            userAddress: snapshot.accountAddress,
            status: ESwapEventAPIStatus.FAIL,
          });
        }
        if (isUserCancelledError(error)) {
          onCancel?.();
          return;
        }
        throw error;
      }
    },
    [
      buildMarketApproveUnsignedTxArr,
      assertLatestFromTokenBalanceSufficient,
      cancelSpeedSwapBuildTx,
      handleMarketSwapBuildTxSuccess,
      isUserCancelledError,
      logMarketCreateOrder,
      openMarketFallbackTxConfirm,
      requireReviewExecutionSnapshot,
    ],
  );

  const sendMarketWrappedTx = useCallback<
    IMarketSwapReviewAdapter['sendWrappedTx']
  >(
    async ({
      gasInfos,
      networkFeeLevel,
      customPriorityFee,
      onBroadcast,
      onCancel,
    } = {}) => {
      const snapshot = requireReviewExecutionSnapshot('wrap');
      const effectiveCustomPriorityFee =
        customPriorityFee ?? snapshot.customPriorityFee;

      try {
        if (snapshot.shouldFallback) {
          setSpeedSwapBuildTxLoading(true);

          await openMarketFallbackTxConfirm({
            accountAddress: snapshot.accountAddress,
            accountId: snapshot.accountId,
            buildUnsignedParams: snapshot.buildUnsignedParams,
            networkFeeLevel,
            networkId: snapshot.networkId,
            customPriorityFee: effectiveCustomPriorityFee,
            onSuccess: async (data) => {
              const result = await handleMarketSwapBuildTxSuccess(data);
              if (result) {
                onBroadcast?.(result);
              }
            },
            onCancel: () => {
              cancelSpeedSwapBuildTx();
              onCancel?.();
            },
          });

          return;
        }

        const data = await sendMarketDirectUnsignedTxs({
          accountAddress: snapshot.accountAddress,
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
          buildUnsignedParams: snapshot.buildUnsignedParams,
          gasInfos,
          networkFeeLevel,
          customPriorityFee: effectiveCustomPriorityFee,
        });
        const result = await handleMarketSwapBuildTxSuccess(data);
        if (result) {
          onBroadcast?.(result);
        }
      } catch (error) {
        cancelSpeedSwapBuildTx();
        if (isUserCancelledError(error)) {
          onCancel?.();
          return;
        }
        throw error;
      }
    },
    [
      cancelSpeedSwapBuildTx,
      handleMarketSwapBuildTxSuccess,
      isUserCancelledError,
      openMarketFallbackTxConfirm,
      requireReviewExecutionSnapshot,
    ],
  );

  const sendMarketSignMessage = useCallback<
    IMarketSwapReviewAdapter['sendSignMessage']
  >(
    async ({
      networkFeeLevel: _networkFeeLevel,
      onBroadcast,
      onCancel,
    } = {}) => {
      const snapshot = requireReviewExecutionSnapshot('swap');

      try {
        const signingQuoteResult = await refreshMarketSigningQuoteResult({
          snapshot,
        });
        const signingFromAmount =
          signingQuoteResult.fromAmount ?? snapshot.swapInfo.sender.amount;
        await assertLatestFromTokenBalanceSufficient({
          token: snapshot.swapInfo.sender.token,
          amount: signingFromAmount,
          accountAddress: snapshot.accountAddress,
          accountId: snapshot.accountId,
        });
        const signedQuoteResult = await signMarketReviewQuoteResult({
          quoteResult: signingQuoteResult,
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
          accountAddress: snapshot.accountAddress,
          receivingAddress: snapshot.swapInfo.receivingAddress,
        });
        const buildRes =
          await backgroundApiProxy.serviceSwap.fetchBuildSpeedSwapTx({
            fromToken: snapshot.swapInfo.sender.token,
            toToken: snapshot.swapInfo.receiver.token,
            fromTokenAmount:
              signedQuoteResult.fromAmount ?? snapshot.swapInfo.sender.amount,
            provider: signedQuoteResult.info.provider,
            userAddress: snapshot.accountAddress,
            receivingAddress: snapshot.swapInfo.receivingAddress,
            slippagePercentage: signedQuoteResult.slippage ?? slippage,
            quoteResultCtx: signedQuoteResult.quoteResultCtx,
            accountId: snapshot.accountId,
            protocol: signedQuoteResult.protocol ?? EProtocolOfExchange.SWAP,
            kind: signedQuoteResult.kind ?? ESwapQuoteKind.SELL,
          });

        if (!buildRes) {
          throw new OneKeyLocalError('Market sign build failed.');
        }

        const { encodedTx, transferInfo, swapInfo, skipSendTransAction } =
          await buildMarketExecutionFromBuildRes({
            buildRes,
            quoteResult: signedQuoteResult,
            currentFromToken: snapshot.swapInfo.sender.token,
            currentToToken: snapshot.swapInfo.receiver.token,
            fromAmount:
              signedQuoteResult.fromAmount ?? snapshot.swapInfo.sender.amount,
            userAddress: snapshot.accountAddress,
            accountId: snapshot.accountId,
          });
        const buildResFinal = mergeMarketBuildResultWithQuote({
          buildRes,
          quoteResult: signedQuoteResult,
        });
        const buildCtx = buildResFinal.ctx as
          | {
              cowSwapOrderId?: string;
              oneInchFusionOrderHash?: string;
              changeHeroOrderId?: string;
            }
          | undefined;
        const signedOrderTrackingId =
          swapInfo.swapBuildResData.orderId ??
          buildCtx?.cowSwapOrderId ??
          buildCtx?.oneInchFusionOrderHash ??
          buildCtx?.changeHeroOrderId;
        const shouldPersistSignedOrder =
          skipSendTransAction || Boolean(signedOrderTrackingId);
        const reviewedBuildResult = assertMarketSignedBuildInvariant({
          reviewedQuoteResult: snapshot.quoteResult,
          rebuiltQuoteResult: buildResFinal.result,
          skipSendTransAction: shouldPersistSignedOrder,
        });

        reviewExecutionSnapshotRef.current = {
          kind: 'swap',
          accountAddress: snapshot.accountAddress,
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
          shouldFallback: snapshot.shouldFallback,
          quoteResult: {
            ...signedQuoteResult,
            info: reviewedBuildResult.info,
            fromAmount: reviewedBuildResult.fromAmount,
            toAmount: reviewedBuildResult.toAmount,
            minToAmount: reviewedBuildResult.minToAmount,
          },
          buildUnsignedParams: {
            networkId: snapshot.networkId,
            accountId: snapshot.accountId,
            transfersInfo: transferInfo ? [transferInfo] : undefined,
            encodedTx,
            swapInfo,
            isInternalSwap: true,
            disableMev: !antiMEV,
          } as ISendTxBaseParams & IBuildUnsignedTxParams,
          swapInfo,
          buildRes: buildResFinal,
          customPriorityFee: snapshot.customPriorityFee,
        };

        if (shouldPersistSignedOrder) {
          const result = await handleMarketSignedOrderSuccess({
            swapInfo,
          });

          onBroadcast?.({
            orderId: result.orderId,
          });
          logMarketCreateOrder({
            buildRes: buildResFinal,
            amount: swapInfo.sender.amount,
            userAddress: snapshot.accountAddress,
            status: ESwapEventAPIStatus.SUCCESS,
          });
        }
      } catch (error) {
        cancelSpeedSwapBuildTx();
        if (snapshot.buildRes) {
          logMarketCreateOrder({
            buildRes: snapshot.buildRes,
            amount: snapshot.swapInfo.sender.amount,
            userAddress: snapshot.accountAddress,
            status: ESwapEventAPIStatus.FAIL,
          });
        }
        if (isUserCancelledError(error)) {
          onCancel?.();
          return;
        }
        throw error;
      }
    },
    [
      antiMEV,
      buildMarketExecutionFromBuildRes,
      assertLatestFromTokenBalanceSufficient,
      cancelSpeedSwapBuildTx,
      handleMarketSignedOrderSuccess,
      isUserCancelledError,
      logMarketCreateOrder,
      requireReviewExecutionSnapshot,
      refreshMarketSigningQuoteResult,
      signMarketReviewQuoteResult,
      slippage,
    ],
  );

  const sendMarketApproveTx = useCallback<
    IMarketSwapReviewAdapter['sendApproveTx']
  >(
    async ({
      amount,
      gasInfos,
      isResetApprove,
      networkFeeLevel,
      customPriorityFee,
      quoteResult,
      onBroadcast,
      onCancel,
    }) => {
      const snapshot = reviewExecutionSnapshotRef.current;
      const effectiveCustomPriorityFee =
        customPriorityFee ?? snapshot?.customPriorityFee;
      const userAddress =
        snapshot?.accountAddress ??
        netAccountRes.result?.addressDetail.address ??
        '';
      const accountId = snapshot?.accountId ?? netAccountRes.result?.id ?? '';
      const spenderAddressFinal =
        quoteResult.allowanceResult?.allowanceTarget ?? effectiveSpenderAddress;

      if (!userAddress || !spenderAddressFinal || !accountId) {
        throw new OneKeyLocalError(
          'Market swap review approve requires spender and user.',
        );
      }

      const approveInfo: IApproveInfo = {
        owner: userAddress,
        spender: spenderAddressFinal,
        amount: isResetApprove ? '0' : amount,
        isMax: !isResetApprove,
        tokenInfo: {
          ...quoteResult.fromTokenInfo,
          isNative: !!quoteResult.fromTokenInfo.isNative,
          address: quoteResult.fromTokenInfo.contractAddress,
          name:
            quoteResult.fromTokenInfo.name ?? quoteResult.fromTokenInfo.symbol,
        },
        swapApproveRes: undefined,
      };

      try {
        if (snapshot?.shouldFallback) {
          const approvingTransaction = buildMarketSwapApprovingTransaction({
            quoteResult,
            amount,
            useAddress: userAddress,
            spenderAddress: spenderAddressFinal,
            isResetApprove,
          });

          setInAppNotificationAtom((prev) => ({
            ...prev,
            speedSwapApprovingLoading: true,
            speedSwapApprovingTransaction: approvingTransaction,
          }));

          await openMarketFallbackTxConfirm({
            accountAddress: userAddress,
            accountId,
            buildUnsignedParams: {
              accountId,
              networkId: quoteResult.fromTokenInfo.networkId,
              approveInfo,
              isInternalSwap: true,
              disableMev: !antiMEV,
            } as ISendTxBaseParams & IBuildUnsignedTxParams,
            networkFeeLevel,
            networkId: quoteResult.fromTokenInfo.networkId,
            customPriorityFee: effectiveCustomPriorityFee,
            approvesInfo: [approveInfo],
            onSuccess: (data) => {
              handleMarketApproveTxSuccess({
                approveInfo,
                approvingTransaction,
                data,
                isResetApprove,
                networkId: quoteResult.fromTokenInfo.networkId,
                onBroadcast,
              });
            },
            onCancel: () => {
              setInAppNotificationAtom((prev) => ({
                ...prev,
                speedSwapApprovingLoading: false,
              }));
              cancelMarketApproveTx();
              onCancel?.();
            },
          });

          return;
        }

        await startMarketApproveTx({
          accountAddress: userAddress,
          accountId,
          networkId: quoteResult.fromTokenInfo.networkId,
          approveInfo,
          approvingTransaction: buildMarketSwapApprovingTransaction({
            quoteResult,
            amount,
            useAddress: userAddress,
            spenderAddress: spenderAddressFinal,
            isResetApprove,
          }),
          gasInfos,
          networkFeeLevel,
          customPriorityFee: effectiveCustomPriorityFee,
          onBroadcast,
          onCancel,
        });
      } catch (error) {
        setInAppNotificationAtom((prev) => ({
          ...prev,
          speedSwapApprovingLoading: false,
        }));
        if (isUserCancelledError(error)) {
          return;
        }
        throw error;
      }
    },
    [
      antiMEV,
      cancelMarketApproveTx,
      effectiveSpenderAddress,
      handleMarketApproveTxSuccess,
      isUserCancelledError,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      openMarketFallbackTxConfirm,
      setInAppNotificationAtom,
      startMarketApproveTx,
    ],
  );

  const buildMarketApproveInfosForReview = useCallback(
    (quoteResult?: IFetchQuoteResult) =>
      buildMarketApproveInfos({
        fromUserAddress: netAccountRes.result?.addressDetail.address,
        quoteResult,
      }),
    [netAccountRes.result?.addressDetail.address],
  );

  const syncTokensBalance = useCallback(
    async ({
      orderFromToken,
      orderToToken,
    }: {
      orderFromToken?: ISwapTokenBase;
      orderToToken?: ISwapTokenBase;
    }) => {
      const currentBalanceToken = {
        networkId: balanceToken?.networkId,
        contractAddress: balanceToken?.contractAddress,
      };
      const matchesCurrentBalanceToken =
        equalTokenNoCaseSensitive({
          token1: orderFromToken,
          token2: currentBalanceToken,
        }) ||
        equalTokenNoCaseSensitive({
          token1: orderToToken,
          token2: currentBalanceToken,
        });
      if (!matchesCurrentBalanceToken) {
        return;
      }

      const accountId = netAccountRes.result?.id;
      const accountAddress = netAccountRes.result?.addressDetail.address;
      const accountNetworkId = netAccountRes.result?.addressDetail.networkId;
      if (
        !accountId ||
        !accountAddress ||
        !balanceToken?.networkId ||
        accountNetworkId !== balanceToken.networkId
      ) {
        balanceRequestIdRef.current += 1;
        setFetchBalanceLoading(false);
        setBalance(new BigNumber(0));
        return;
      }

      const currentRequestId = balanceRequestIdRef.current + 1;
      balanceRequestIdRef.current = currentRequestId;
      setFetchBalanceLoading(true);

      try {
        const tokenDetail =
          await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: balanceToken.networkId,
            contractAddress: balanceToken.contractAddress ?? '',
            accountId,
            accountAddress,
            currency: 'usd',
          });
        if (currentRequestId !== balanceRequestIdRef.current) {
          return;
        }

        setBalance(new BigNumber(tokenDetail?.[0]?.balanceParsed ?? 0));
      } catch (_e) {
        if (currentRequestId !== balanceRequestIdRef.current) {
          return;
        }

        setBalance(new BigNumber(0));
      } finally {
        if (currentRequestId === balanceRequestIdRef.current) {
          setFetchBalanceLoading(false);
        }
      }
    },
    [
      balanceToken?.networkId,
      balanceToken?.contractAddress,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      netAccountRes.result?.addressDetail.networkId,
    ],
  );

  const fetchTokenPrice = useCallback(async () => {
    const currentRequestId = priceRequestIdRef.current + 1;
    priceRequestIdRef.current = currentRequestId;
    const fromTokenPriceBN =
      tradeType === ESwapDirection.BUY
        ? effectiveTradeTokenPrice
        : new BigNumber(fromToken.price || 0);
    const toTokenPriceBN =
      tradeType === ESwapDirection.SELL
        ? effectiveTradeTokenPrice
        : new BigNumber(toToken.price || 0);
    const canUseInlineTokenPrices =
      !fromTokenPriceBN.isNaN() &&
      !toTokenPriceBN.isNaN() &&
      fromTokenPriceBN.gt(0) &&
      toTokenPriceBN.gt(0);

    setPriceRate({
      rate: undefined,
      fromTokenSymbol: fromToken.symbol,
      toTokenSymbol: toToken.symbol,
      loading: true,
    });
    if (canUseInlineTokenPrices) {
      if (currentRequestId !== priceRequestIdRef.current) {
        return;
      }

      setPriceRate({
        rate: toTokenPriceBN.isZero()
          ? 0
          : fromTokenPriceBN.dividedBy(toTokenPriceBN).toNumber(),
        fromTokenSymbol: fromToken.symbol,
        toTokenSymbol: toToken.symbol,
        loading: false,
      });
      return;
    }

    if (!fromToken?.networkId || !toToken?.networkId) {
      if (currentRequestId !== priceRequestIdRef.current) {
        return;
      }

      setPriceRate({
        rate: undefined,
        fromTokenSymbol: fromToken.symbol,
        toTokenSymbol: toToken.symbol,
        loading: false,
      });
      return;
    }

    try {
      const [fromTokenPrice, toTokenPrice] = await Promise.all([
        backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: fromToken.networkId ?? '',
          contractAddress: fromToken.contractAddress ?? '',
          currency: 'usd',
        }),
        backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: toToken.networkId ?? '',
          contractAddress: toToken.contractAddress ?? '',
          currency: 'usd',
        }),
      ]);
      if (currentRequestId !== priceRequestIdRef.current) {
        return;
      }

      if (fromTokenPrice?.length && toTokenPrice?.length) {
        const fetchedFromTokenPriceBN = new BigNumber(
          fromTokenPrice[0].price || 0,
        );
        const fetchedToTokenPriceBN = new BigNumber(toTokenPrice[0].price || 0);
        setPriceRate({
          rate: fetchedToTokenPriceBN.isZero()
            ? 0
            : fetchedFromTokenPriceBN
                .dividedBy(fetchedToTokenPriceBN)
                .toNumber(),
          fromTokenSymbol: fromToken.symbol,
          toTokenSymbol: toToken.symbol,
          loading: false,
        });
        return;
      }
    } catch (_e) {
      if (currentRequestId !== priceRequestIdRef.current) {
        return;
      }
    }

    if (currentRequestId !== priceRequestIdRef.current) {
      return;
    }

    setPriceRate({
      rate: undefined,
      fromTokenSymbol: fromToken.symbol,
      toTokenSymbol: toToken.symbol,
      loading: false,
    });
  }, [
    effectiveTradeTokenPrice,
    tradeType,
    fromToken.price,
    fromToken.symbol,
    fromToken.networkId,
    fromToken.contractAddress,
    toToken.price,
    toToken.symbol,
    toToken.networkId,
    toToken.contractAddress,
  ]);

  useEffect(() => {
    if (fromToken.networkId && toToken.networkId) {
      void fetchTokenPrice();
    }
  }, [
    fetchTokenPrice,
    fromToken.networkId,
    toToken.networkId,
    fromToken.contractAddress,
    toToken.contractAddress,
  ]);

  useEffect(() => {
    if (fromToken?.networkId && fromToken?.isNative) {
      void (async () => {
        const nativeTokenConfig =
          await backgroundApiProxy.serviceSwap.fetchSwapNativeTokenConfig({
            networkId: fromToken.networkId,
          });
        setSwapNativeTokenReserveGas((pre) => {
          const find = pre.find(
            (item) => item.networkId === fromToken.networkId,
          );
          if (find) {
            return [
              ...pre.filter((item) => item.networkId !== fromToken.networkId),
              {
                networkId: fromToken.networkId,
                reserveGas: nativeTokenConfig.reserveGas,
              },
            ];
          }
          return [...pre, nativeTokenConfig];
        });
      })();
    }
  }, [fromToken?.networkId, fromToken?.isNative, setSwapNativeTokenReserveGas]);

  useEffect(() => {
    appEventBus.off(
      EAppEventBusNames.SwapSpeedBalanceUpdate,
      syncTokensBalance,
    );
    appEventBus.on(EAppEventBusNames.SwapSpeedBalanceUpdate, syncTokensBalance);
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapSpeedBalanceUpdate,
        syncTokensBalance,
      );
    };
  }, [syncTokensBalance]);

  const runSpeedCheckAndAllowance = useCallback(
    async (amount: string) => {
      const amountBN = new BigNumber(amount || 0);
      if (amountBN.isNaN() || amountBN.lte(0)) {
        setSpeedCheckError(defaultMarketSpeedCheckState.speedCheckError);
        setCheckSpenderAddress(
          defaultMarketSpeedCheckState.checkSpenderAddress,
        );
        setIsStock(defaultMarketSpeedCheckState.isStock);
        setShouldApprove(defaultMarketSpeedCheckState.shouldApprove);
        setShouldResetApprove(defaultMarketSpeedCheckState.shouldResetApprove);
        return;
      }

      speedCheckRequestIdRef.current += 1;
      const currentRequestId = speedCheckRequestIdRef.current;

      setSpeedCheckLoading(true);
      setSpeedCheckError('');
      try {
        const checkResult =
          await backgroundApiProxy.serviceSwap.fetchSpeedCheck({
            fromNetworkId: fromToken.networkId,
            toNetworkId: toToken.networkId,
            fromTokenAddress: fromToken.contractAddress,
            toTokenAddress: toToken.contractAddress,
            fromTokenAmount: amount,
            protocol: EProtocolOfExchange.SWAP,
          });

        // Discard stale response
        if (currentRequestId !== speedCheckRequestIdRef.current) {
          return;
        }

        const stockFlag = !!checkResult?.isStock && !checkResult?.errorMessage;
        setIsStock(stockFlag);

        if (checkResult?.errorMessage) {
          setSpeedCheckError(checkResult.errorMessage);
          setSpeedCheckLoading(false);
          setShouldApprove(false);
          setShouldResetApprove(false);
          return;
        }

        const newSpenderAddress = checkResult?.spenderAddress || '';
        setCheckSpenderAddress(newSpenderAddress);
        setSpeedCheckLoading(false);

        // Proceed with allowance check if non-native token
        if (
          !fromToken.isNative &&
          !isWrapped &&
          fromToken.contractAddress &&
          netAccountRes?.result?.addressDetail.address &&
          (newSpenderAddress || spenderAddress)
        ) {
          void checkTokenApproveAllowance(
            amount,
            newSpenderAddress || spenderAddress,
          );
        } else {
          setShouldApprove(false);
          setShouldResetApprove(false);
        }
      } catch (_e) {
        if (currentRequestId === speedCheckRequestIdRef.current) {
          setSpeedCheckLoading(false);
          setIsStock(false);
        }
      }
    },
    [
      defaultMarketSpeedCheckState,
      fromToken.networkId,
      fromToken.contractAddress,
      fromToken.isNative,
      toToken.networkId,
      toToken.contractAddress,
      isWrapped,
      netAccountRes?.result?.addressDetail.address,
      spenderAddress,
      checkTokenApproveAllowance,
    ],
  );

  const runSpeedCheckAndAllowanceRef = useRef(runSpeedCheckAndAllowance);
  runSpeedCheckAndAllowanceRef.current = runSpeedCheckAndAllowance;

  useEffect(() => {
    const fromTokenAmountDebouncedBN = new BigNumber(
      fromTokenAmountDebounced || 0,
    );
    if (
      (!fromTokenAmountDebouncedBN.isNaN() &&
        fromTokenAmountDebouncedBN.gt(0) &&
        netAccountRes?.result?.addressDetail.address &&
        balance?.gt(0)) ||
      inAppNotificationAtom.speedSwapApprovingTransaction?.status ===
        ESwapApproveTransactionStatus.SUCCESS
    ) {
      void runSpeedCheckAndAllowanceRef.current(
        fromTokenAmountDebouncedBN.toFixed(),
      );
    } else {
      setSpeedCheckError(defaultMarketSpeedCheckState.speedCheckError);
      setCheckSpenderAddress(defaultMarketSpeedCheckState.checkSpenderAddress);
      setIsStock(defaultMarketSpeedCheckState.isStock);
      setShouldApprove(defaultMarketSpeedCheckState.shouldApprove);
      setShouldResetApprove(defaultMarketSpeedCheckState.shouldResetApprove);
    }
  }, [
    defaultMarketSpeedCheckState,
    isWrapped,
    balance,
    fromToken.isNative,
    fromToken.networkId,
    fromToken.contractAddress,
    toToken.networkId,
    toToken.contractAddress,
    fromTokenAmountDebounced,
    inAppNotificationAtom.speedSwapApprovingTransaction?.status,
    netAccountRes?.result?.addressDetail.address,
  ]);

  useEffect(() => {
    void syncTokensBalance({
      orderFromToken: balanceRefreshToken,
    });
  }, [
    balanceRefreshToken,
    netAccountRes.result?.addressDetail.address,
    syncTokensBalance,
  ]);

  return {
    speedSwapBuildTxLoading,
    swapApprovingMatchLoading,
    checkTokenApproveAllowance,
    checkTokenAllowanceLoading,
    shouldApprove,
    balance,
    balanceToken,
    fetchBalanceLoading,
    swapNativeTokenReserveGas,
    priceRate,
    isWrapped,
    speedCheckError,
    speedCheckLoading,
    prepareMarketSwapReview,
    sendMarketApproveTx,
    sendMarketSwapTx,
    sendMarketWrappedTx,
    sendMarketSignMessage,
    buildMarketApproveInfos: buildMarketApproveInfosForReview,
  };
}
