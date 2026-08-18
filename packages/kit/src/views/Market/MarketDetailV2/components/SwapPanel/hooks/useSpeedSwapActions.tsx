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

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteCurrentEventReceivedCountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteEventCompletedAtom,
  useSwapQuoteEventErrorAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  getSwapQuoteProgressState,
  isSwapQuoteEventFetching,
  isSwapQuoteRequestForCurrentInput,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress';
import { getGasAccountErrorEntry } from '@onekeyhq/kit/src/views/SignatureConfirm/constants/gasAccountErrorCodes';
import { type ISwapReviewStepTexts } from '@onekeyhq/kit/src/views/Swap/utils/buildSwapReviewState';
import { logDirectSwapGasAccountDecision } from '@onekeyhq/kit/src/views/Swap/utils/gasAccountAnalytics';
import {
  checkSwapLatestBalanceSufficient,
  getSwapRequiredNativeBalanceAmount,
} from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils';
import type {
  ISwapReviewAdapter,
  ISwapReviewApproveBroadcastResult,
  ISwapReviewCustomPriorityFee,
  ISwapReviewGasInfoEntry,
  ISwapReviewState,
} from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import {
  buildCustomSlippageQuoteResultCtx,
  buildRebuiltSwapReviewQuoteResult,
} from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import {
  getStockTradeAnalyticsPayload,
  getSwapAnalyticsCategoryFromQuoteResult,
} from '@onekeyhq/kit/src/views/Swap/utils/swapStockAnalytics';
import { getSwapExecutionTypeFromQuoteResult } from '@onekeyhq/kit/src/views/Swap/utils/swapTypeUtils';
import {
  useCurrencyPersistAtom,
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
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { getGasAccountErrorCode } from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapEventAPIStatus } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee';
import type { IGasAccountAnalyticsContext } from '@onekeyhq/shared/src/logger/scopes/transaction/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import {
  buildSwapHistoryNetworkFromServer,
  buildSwapHistoryNetworkPlaceholder,
} from '@onekeyhq/shared/src/utils/swapHistoryNetworkUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import {
  EMessageTypesEth,
  ESigningScheme,
} from '@onekeyhq/shared/types/message';
import {
  SWAP_PRO_QUOTE_INPUT_DEBOUNCE_MS,
  wrappedTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
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
  ESwapQuoteSource,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
  ESwapTradeSource,
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
  estimateMarketPresetGasFeeFiatValues,
  resolveMarketPresetNativeTokenPrice,
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
  buildMarketReviewShouldFallback,
  mergeMarketBuildResultWithQuote,
  resolveMarketQuoteActionState,
} from './marketSwapBuildUtils';
import {
  areMarketApproveAmountsEqual,
  assertMarketReviewQuoteResult,
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

import type { IMarketPresetPriorityFeeOverride } from './marketPresetSettings';

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
  gasAccountAnalyticsContext?: IGasAccountAnalyticsContext;
  gasAccountAnalyticsNativeBalance?: string;
  // customPriorityFee is owned by the swapStepNetFeeLevel atom; never snapshot
  // it here, or a cleared preset fee would resurrect via `?? snapshot.value`.
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

export function parseMarketTokenBalance(balanceParsed?: string | null) {
  if (balanceParsed === undefined || balanceParsed === null) {
    return undefined;
  }

  const balance = new BigNumber(balanceParsed);
  return balance.isFinite() && !balance.isNaN() && !balance.isNegative()
    ? balance
    : undefined;
}

export function isMarketUserCancelledError(error: unknown) {
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
    normalizedError?.message?.toLowerCase().includes('reject') === true
  );
}

export function buildMarketReviewTokens({
  tradeType,
  fromToken,
  toToken,
  tradeTokenPrice,
  tradeTokenCurrency,
}: {
  tradeType: ESwapDirection;
  fromToken: ISwapToken;
  toToken: ISwapToken;
  tradeTokenPrice?: BigNumber;
  tradeTokenCurrency?: string;
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
        currency: tradeTokenCurrency ?? fromToken.currency,
      },
      toToken,
    };
  }

  return {
    fromToken,
    toToken: {
      ...toToken,
      price: resolvedPrice,
      currency: tradeTokenCurrency ?? toToken.currency,
    },
  };
}

type IMarketSwapBuildCtx = {
  cowSwapOrderId?: string;
  oneInchFusionOrderHash?: string;
  changeHeroOrderId?: string;
};

function buildMarketSwapHistoryNetwork(token: ISwapToken) {
  const presetNetwork = Object.values(presetNetworksMap).find(
    (network) => network.id === token.networkId,
  );
  return presetNetwork
    ? buildSwapHistoryNetworkFromServer({ network: presetNetwork, token })
    : buildSwapHistoryNetworkPlaceholder(token);
}

export function buildMarketSwapHistoryItem({
  swapInfo,
  txHash,
  gasFeeFiatValue,
  gasFeeInNative,
  currency,
  currencyId,
  now = Date.now,
}: {
  swapInfo: ISwapTxInfo;
  txHash?: string;
  gasFeeFiatValue?: string;
  gasFeeInNative?: string;
  currency?: string;
  currencyId?: string;
  now?: () => number;
}) {
  const buildCtx = swapInfo.swapBuildResData.ctx as
    | IMarketSwapBuildCtx
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
  const useOrderId = Boolean(
    (!txHash && historyOrderId) ||
    buildCtx?.cowSwapOrderId ||
    buildCtx?.oneInchFusionOrderHash,
  );

  const swapHistoryItem: ISwapTxHistory = {
    status: ESwapTxHistoryStatus.PENDING,
    currency,
    currencyId,
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
      fromNetwork: buildMarketSwapHistoryNetwork(swapInfo.sender.token),
      toNetwork: buildMarketSwapHistoryNetwork(swapInfo.receiver.token),
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
      created: now(),
      updated: now(),
    },
    swapInfo: {
      instantRate: swapInfo.swapBuildResData.result?.instantRate ?? '',
      provider: swapInfo.swapBuildResData.result?.info,
      socketBridgeScanUrl: swapInfo.swapBuildResData.socketBridgeScanUrl,
      oneKeyFee: swapInfo.swapBuildResData.result?.fee?.percentageFee,
      protocolFee: swapInfo.swapBuildResData.result?.fee?.protocolFees,
      hideProtocolFee: true,
      otherFeeInfos: swapInfo.swapBuildResData.result?.fee?.otherFeeInfos ?? [],
      orderId: serviceOrderId,
      supportUrl: swapInfo.swapBuildResData.result?.supportUrl,
      orderSupportUrl: swapInfo.swapBuildResData.result?.orderSupportUrl,
      oneKeyFeeExtraInfo: swapInfo.swapBuildResData.result?.oneKeyFeeExtraInfo,
    },
    ctx: swapInfo.swapBuildResData.ctx,
  };

  return {
    swapHistoryItem,
    historyOrderId,
  };
}

export function useSpeedSwapActions(props: {
  marketToken: ISwapToken;
  tradeToken: ISwapTokenBase;
  tradeType: ESwapDirection;
  fromTokenAmount: string;
  slippage: number;
  antiMEV: boolean;
  isCustomRpcUnavailable?: boolean;
  isReviewDialogOpen?: boolean;
  onCloseDialog?: () => void;
  /**
   * Live per-stock open state from the token detail. Flips refresh the current
   * provider quote so a stale server-reported closed error clears on reopen.
   * Market status itself never gates quoting.
   */
  stockIsOpen?: boolean;
}) {
  const {
    marketToken,
    fromTokenAmount,
    tradeToken,
    tradeType,
    slippage,
    antiMEV,
    isCustomRpcUnavailable,
    isReviewDialogOpen,
    // onCloseDialog,
    stockIsOpen,
  } = props;

  const intl = useIntl();
  const [inAppNotificationAtom, setInAppNotificationAtom] =
    useInAppNotificationAtom();
  const [settingsAtom] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
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
  const [balance, setBalance] = useState<BigNumber | undefined>();
  const balanceRequestIdRef = useRef(0);
  const priceRequestIdRef = useRef(0);
  const reviewExecutionSnapshotRef = useRef<
    IMarketReviewExecutionSnapshot | undefined
  >(undefined);
  const [selectedQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const [quoteActionLock] = useSwapQuoteActionLockAtom();
  const [quoteList] = useSwapQuoteListAtom();
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [quoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();
  const [currentEventReceivedCount] =
    useSwapQuoteCurrentEventReceivedCountAtom();
  const [quoteEventError] = useSwapQuoteEventErrorAtom();
  const [shouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
  const [, setSwapFromToken] = useSwapSelectFromTokenAtom();
  const [, setSwapToToken] = useSwapSelectToTokenAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [, setManualSelectQuoteProvider] =
    useSwapManualSelectQuoteProvidersAtom();
  const {
    quoteAction,
    quoteEventHandler,
    resetQuoteAction,
    cleanQuoteInterval,
    closeQuoteEvent,
  } = useSwapActions().current;
  const quoteRequestIdRef = useRef(quoteActionLock.quoteRequestId);
  quoteRequestIdRef.current = quoteActionLock.quoteRequestId;
  const gasAccountDecisionSnapshotsRef = useRef(
    new WeakSet<IMarketReviewExecutionSnapshot>(),
  );
  const effectiveSpenderAddress =
    selectedQuoteResult?.allowanceResult?.allowanceTarget ?? '';

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
  const fromTokenRef = useRef(fromToken);
  const toTokenRef = useRef(toToken);
  fromTokenRef.current = fromToken;
  toTokenRef.current = toToken;
  const currentCurrencyId = settingsAtom.currencyInfo.id;
  const tradeTokenPriceKey = `${tradeToken.networkId ?? ''}:${
    tradeToken.contractAddress ?? ''
  }:${currentCurrencyId}`;
  const { price: liveTradeTokenPrice, tokenKey: liveTradeTokenPriceKey } =
    usePaymentTokenPrice(tradeToken, tradeToken.networkId, currentCurrencyId);
  const fallbackTradeTokenPrice = useMemo(() => {
    if (tradeToken.currency && tradeToken.currency !== currentCurrencyId) {
      return new BigNumber(0);
    }
    return new BigNumber(tradeToken.price || 0);
  }, [currentCurrencyId, tradeToken.currency, tradeToken.price]);
  const effectiveTradeTokenPrice = useMemo(() => {
    if (liveTradeTokenPriceKey === tradeTokenPriceKey) {
      return liveTradeTokenPrice ?? fallbackTradeTokenPrice;
    }

    return fallbackTradeTokenPrice;
  }, [
    fallbackTradeTokenPrice,
    liveTradeTokenPrice,
    liveTradeTokenPriceKey,
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

  const fromTokenAmountDebounced = useDebounce(
    fromTokenAmount,
    SWAP_PRO_QUOTE_INPUT_DEBOUNCE_MS,
    {
      leading: true,
    },
  );
  const quoteProgressState = useMemo(
    () =>
      getSwapQuoteProgressState({
        quoteLoading: quoteFetching,
        quoteEventFetching: isSwapQuoteEventFetching({
          quoteEventTotalCount,
          currentEventReceivedCount,
          quoteEventCompleted,
        }),
        quoteCurrentSelect: selectedQuoteResult,
        quoteEventTotalCount,
        quoteEventCompleted,
        quoteEventError,
      }),
    [
      currentEventReceivedCount,
      quoteEventCompleted,
      quoteEventError,
      quoteEventTotalCount,
      quoteFetching,
      selectedQuoteResult,
    ],
  );
  const quoteRequestMatchesCurrentInput = useMemo(
    () =>
      isSwapQuoteRequestForCurrentInput({
        currentAccountId: netAccountRes.result?.id,
        currentAddress: netAccountRes.result?.addressDetail.address,
        currentReceivingAddress: netAccountRes.result?.addressDetail.address,
        currentSwapType: ESwapTabSwitchType.SWAP,
        fromAmount: fromTokenAmountDebounced,
        fromToken,
        quoteKind: ESwapQuoteKind.SELL,
        quoteRequest: quoteActionLock,
        toAmount: '',
        toToken,
      }),
    [
      fromToken,
      fromTokenAmountDebounced,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      quoteActionLock,
      toToken,
    ],
  );
  const quoteActionState = useMemo(
    () =>
      resolveMarketQuoteActionState({
        hasActionableQuote: quoteProgressState.hasActionableQuote,
        quoteRequestMatchesCurrentInput,
        quoteRequestLocked: quoteActionLock.actionLock,
        quoteFetching,
        shouldRefreshQuote,
        hasQuoteError: Boolean(
          quoteEventError?.message || selectedQuoteResult?.errorMessage,
        ),
      }),
    [
      quoteActionLock.actionLock,
      quoteEventError?.message,
      quoteFetching,
      quoteProgressState.hasActionableQuote,
      quoteRequestMatchesCurrentInput,
      selectedQuoteResult?.errorMessage,
      shouldRefreshQuote,
    ],
  );
  const quoteExecutionStateRef = useRef({
    actionState: quoteActionState,
    selectedQuoteResult,
  });
  quoteExecutionStateRef.current = {
    actionState: quoteActionState,
    selectedQuoteResult,
  };

  const refreshMarketQuote = useCallback(() => {
    const userAddress = netAccountRes.result?.addressDetail.address;
    const accountId = netAccountRes.result?.id;
    if (
      !quoteExecutionStateRef.current.actionState.canRefresh ||
      !userAddress ||
      !accountId
    ) {
      return;
    }

    void quoteAction(
      {
        key: ESwapSlippageSegmentKey.CUSTOM,
        value: slippage,
      },
      userAddress,
      accountId,
      undefined,
      undefined,
      ESwapQuoteKind.SELL,
      true,
      userAddress,
      undefined,
      {
        fromToken,
        toToken,
        fromTokenAmount: fromTokenAmountDebounced,
        type: ESwapTabSwitchType.SWAP,
        source: ESwapQuoteSource.MARKET,
      },
    );
  }, [
    fromToken,
    fromTokenAmountDebounced,
    netAccountRes.result?.addressDetail.address,
    netAccountRes.result?.id,
    quoteAction,
    slippage,
    toToken,
  ]);

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
      const { historyOrderId, swapHistoryItem } = buildMarketSwapHistoryItem({
        swapInfo,
        txHash,
        gasFeeFiatValue,
        gasFeeInNative,
        currency: settingsAtom.currencyInfo?.symbol,
        currencyId: settingsAtom.currencyInfo?.id,
      });

      if (
        swapInfo.protocol === EProtocolOfExchange.SWAP ||
        swapInfo.swapBuildResData.result.isWrapped
      ) {
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
    [settingsAtom.currencyInfo?.id, settingsAtom.currencyInfo?.symbol],
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
      const swapType = getSwapExecutionTypeFromQuoteResult(
        buildResFinal.result,
      );
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
        swapType,
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

  const assertLatestWrappedExecutionBalancesSufficient = useCallback(
    async ({
      snapshot,
      gasInfos,
    }: {
      snapshot: IMarketReviewExecutionSnapshot;
      gasInfos?: ISwapReviewGasInfoEntry[];
    }) => {
      const wrappedFromToken = snapshot.swapInfo.sender.token;
      const fromAmount = snapshot.swapInfo.sender.amount;
      const nativeBalanceRequirement = getSwapRequiredNativeBalanceAmount({
        gasInfos,
        networkId: snapshot.networkId,
        fromToken: wrappedFromToken,
        fromAmount,
        otherFeeInfos: snapshot.quoteResult.fee?.otherFeeInfos,
      });

      if (!wrappedFromToken.isNative || !nativeBalanceRequirement) {
        await assertLatestFromTokenBalanceSufficient({
          token: wrappedFromToken,
          amount: fromAmount,
          accountAddress: snapshot.accountAddress,
          accountId: snapshot.accountId,
        });
      }

      if (nativeBalanceRequirement) {
        await assertLatestFromTokenBalanceSufficient({
          token: nativeBalanceRequirement.token,
          amount: nativeBalanceRequirement.amount,
          accountAddress: snapshot.accountAddress,
          accountId: snapshot.accountId,
        });
      }
    },
    [assertLatestFromTokenBalanceSufficient],
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

      const {
        actionState: capturedQuoteActionState,
        selectedQuoteResult: selectedQuote,
      } = quoteExecutionStateRef.current;
      if (!capturedQuoteActionState.canReview) {
        throw new OneKeyLocalError(
          'Market swap review requires a current quote.',
        );
      }
      if (
        !selectedQuote?.info.provider ||
        !selectedQuote.toAmount ||
        selectedQuote.errorMessage
      ) {
        throw new OneKeyLocalError(
          selectedQuote?.errorMessage ??
            'Market swap review requires an available quote.',
        );
      }

      await assertLatestFromTokenBalanceSufficient({
        token: fromTokenFinal,
        amount,
        accountAddress: userAddress,
        accountId: netAccountRes.result.id,
      });

      if (
        !quoteExecutionStateRef.current.actionState.canReview ||
        quoteExecutionStateRef.current.selectedQuoteResult !== selectedQuote
      ) {
        throw new OneKeyLocalError(
          'Market swap quote changed while preparing review.',
        );
      }

      setSpeedSwapBuildTxLoading(true);
      try {
        const buildRes = await backgroundApiProxy.serviceSwap.fetchBuildTx({
          fromToken: fromTokenFinal,
          toToken: toTokenFinal,
          fromTokenAmount: selectedQuote.fromAmount ?? amount,
          toTokenAmount: selectedQuote.toAmount,
          provider: selectedQuote.info.provider,
          userAddress,
          receivingAddress: userAddress,
          slippagePercentage: selectedQuote.slippage ?? slippage,
          quoteResultCtx: selectedQuote.quoteResultCtx,
          accountId: netAccountRes.result.id,
          protocol: selectedQuote.protocol ?? EProtocolOfExchange.SWAP,
          kind: selectedQuote.kind ?? ESwapQuoteKind.SELL,
          tradeSource: ESwapTradeSource.MARKET_DEX,
        });

        if (!buildRes) {
          throw new OneKeyLocalError('Market swap review build failed.');
        }

        const buildResFinal = mergeMarketBuildResultWithQuote({
          buildRes,
          quoteResult: selectedQuote,
        });

        const { encodedTx, transferInfo, swapInfo } =
          await buildMarketExecutionFromBuildRes({
            buildRes: buildResFinal,
            quoteResult: selectedQuote,
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
      fromTokenAmountDebounced,
      fromToken,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
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
        swapType: getSwapExecutionTypeFromQuoteResult(buildRes.result),
        orderType: getSwapAnalyticsCategoryFromQuoteResult(buildRes.result),
        slippage: (buildRes.result.slippage ?? slippage).toString(),
        sourceChain: fromToken.networkId ?? '',
        receivedChain: toToken.networkId ?? '',
        sourceTokenSymbol: fromToken.symbol ?? '',
        receivedTokenSymbol: toToken.symbol ?? '',
        feeType: buildRes.result?.fee?.percentageFee?.toString() ?? '0',
        router: JSON.stringify(buildRes.result?.routesData ?? ''),
        isFirstTime: settingsAtom.isFirstTimeSwap,
        createFrom: 'marketDex',
        ...getStockTradeAnalyticsPayload({
          protocol: buildRes.result?.protocol,
          fromToken: buildRes.result?.fromTokenInfo,
          toToken: buildRes.result?.toTokenInfo,
        }),
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
      options?: { throwOnEstimateError?: boolean },
    ) => {
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
        slippage: snapshot.quoteResult.slippage ?? slippage,
        rateDifference: buildMarketReviewRateDifference({
          quoteResult: snapshot.quoteResult,
          swapInfo: snapshot.swapInfo,
          defaultTokenCurrency: settingsAtom.currencyInfo.id,
          currencyMap,
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
            customPriorityFee,
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
            customPriorityFee,
            gasAccountAnalytics:
              snapshot.kind === 'swap'
                ? {
                    fiatCurrency: settingsAtom.currencyInfo.id,
                    useGasAccountByDefault: settingsAtom.useGasAccountByDefault,
                  }
                : undefined,
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

          if (
            feeState.gasAccountAnalyticsContext &&
            reviewExecutionSnapshotRef.current === snapshot
          ) {
            snapshot.gasAccountAnalyticsContext =
              feeState.gasAccountAnalyticsContext;
            snapshot.gasAccountAnalyticsNativeBalance =
              feeState.gasAccountAnalyticsNativeBalance;
          }

          netWorkFee = {
            gasInfos: feeState.gasInfos,
            gasFeeFiatValue: feeState.gasFeeFiatValue,
          };
        }
      } catch (error) {
        if (options?.throwOnEstimateError) {
          throw error;
        }
        netWorkFee = undefined;
      }

      if (snapshot.kind === 'wrap') {
        await assertLatestWrappedExecutionBalancesSufficient({
          snapshot,
          gasInfos: netWorkFee?.gasInfos,
        });
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
    [
      assertLatestWrappedExecutionBalancesSufficient,
      buildMarketApproveUnsignedTxArr,
      buildReviewStepTexts,
      currencyMap,
      settingsAtom.currencyInfo.id,
      settingsAtom.useGasAccountByDefault,
      slippage,
    ],
  );

  const estimateMarketPresetNetworkFees = useCallback(
    async ({
      items,
    }: {
      items: {
        customPriorityFee?: IMarketPresetPriorityFeeOverride;
        networkFeeLevel?: ESwapNetworkFeeLevel;
      }[];
    }) => {
      const accountAddress =
        netAccountRes.result?.addressDetail.address ??
        account?.account?.address ??
        '';
      const accountId = netAccountRes.result?.id ?? account?.account?.id ?? '';
      const networkId = fromToken.networkId;

      if (!accountAddress || !accountId || !networkId) {
        return items.map(() => undefined);
      }

      const nativeTokenPrice = await resolveMarketPresetNativeTokenPrice({
        networkId,
        currencyId: settingsAtom.currencyInfo.id,
        tokens: [fromToken, toToken],
      });

      return estimateMarketPresetGasFeeFiatValues({
        accountAddress,
        accountId,
        amount: fromTokenAmountDebounced,
        items,
        nativeTokenPrice,
        networkId,
        token: fromToken,
      });
    },
    [
      fromToken,
      fromTokenAmountDebounced,
      account?.account?.address,
      account?.account?.id,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      settingsAtom.currencyInfo.id,
      toToken,
    ],
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
          tradeTokenCurrency: currentCurrencyId,
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
      currentCurrencyId,
      effectiveSpenderAddress,
      effectiveTradeTokenPrice,
      fromToken,
      fromTokenAmountDebounced,
      isCustomRpcUnavailable,
      isWrapped,
      netAccountRes.result?.id,
      netAccountRes.result?.addressDetail.address,
      shouldApprove,
      shouldResetApprove,
      slippage,
      tradeType,
      toToken,
    ],
  );

  const rebuildMarketSwapReview = useCallback<
    NonNullable<IMarketSwapReviewAdapter['rebuildReview']>
  >(
    async ({
      slippagePercentage,
      networkFeeLevel = ESwapNetworkFeeLevel.MEDIUM,
      customPriorityFee,
    }) => {
      const snapshot = reviewExecutionSnapshotRef.current;
      if (snapshot?.kind !== 'swap' || !snapshot.buildRes?.supportRebuildTx) {
        throw new OneKeyLocalError(
          'Current market swap quote does not support rebuilding.',
        );
      }

      const frozenQuoteResult = snapshot.quoteResult;
      const fromTokenFinal = snapshot.swapInfo.sender.token;
      const toTokenFinal = snapshot.swapInfo.receiver.token;
      const amount =
        frozenQuoteResult.fromAmount ?? snapshot.swapInfo.sender.amount;

      await assertLatestFromTokenBalanceSufficient({
        token: fromTokenFinal,
        amount,
        accountAddress: snapshot.accountAddress,
        accountId: snapshot.accountId,
      });

      const buildRes = await backgroundApiProxy.serviceSwap.fetchBuildTx({
        fromToken: fromTokenFinal,
        toToken: toTokenFinal,
        fromTokenAmount: amount,
        toTokenAmount:
          frozenQuoteResult.toAmount ?? snapshot.swapInfo.receiver.amount,
        provider: frozenQuoteResult.info.provider,
        userAddress: snapshot.accountAddress,
        receivingAddress: snapshot.accountAddress,
        slippagePercentage,
        quoteResultCtx: buildCustomSlippageQuoteResultCtx(
          frozenQuoteResult.quoteResultCtx,
        ),
        accountId: snapshot.accountId,
        protocol: frozenQuoteResult.protocol ?? EProtocolOfExchange.SWAP,
        kind: frozenQuoteResult.kind ?? ESwapQuoteKind.SELL,
        tradeSource: ESwapTradeSource.MARKET_DEX,
      });
      if (!buildRes) {
        throw new OneKeyLocalError('Market swap review rebuild failed.');
      }

      const mergedBuildRes = mergeMarketBuildResultWithQuote({
        buildRes,
        quoteResult: frozenQuoteResult,
      });
      const buildResFinal: IFetchBuildTxResponse = {
        ...mergedBuildRes,
        result: {
          ...mergedBuildRes.result,
          slippage: slippagePercentage,
        },
      };
      const rebuiltQuoteResult = assertMarketReviewQuoteResult(
        buildRebuiltSwapReviewQuoteResult({
          quoteResult: frozenQuoteResult,
          buildResult: buildResFinal.result,
          slippagePercentage,
        }),
      );
      const { encodedTx, transferInfo, swapInfo } =
        await buildMarketExecutionFromBuildRes({
          buildRes: buildResFinal,
          quoteResult: rebuiltQuoteResult,
          currentFromToken: fromTokenFinal,
          currentToToken: toTokenFinal,
          fromAmount: amount,
          userAddress: snapshot.accountAddress,
          accountId: snapshot.accountId,
        });

      const nextSnapshot: IMarketReviewExecutionSnapshot = {
        ...snapshot,
        quoteResult: rebuiltQuoteResult,
        buildUnsignedParams: {
          ...snapshot.buildUnsignedParams,
          transfersInfo: transferInfo ? [transferInfo] : undefined,
          encodedTx,
          swapInfo,
        },
        swapInfo,
        buildRes: buildResFinal,
      };
      const nextReviewState = await buildMarketReviewStateFromSnapshot(
        nextSnapshot,
        networkFeeLevel,
        customPriorityFee,
        { throwOnEstimateError: true },
      );
      if (reviewExecutionSnapshotRef.current !== snapshot) {
        throw new OneKeyLocalError(
          'Market swap review changed while rebuilding.',
        );
      }
      reviewExecutionSnapshotRef.current = nextSnapshot;
      return nextReviewState;
    },
    [
      assertLatestFromTokenBalanceSufficient,
      buildMarketExecutionFromBuildRes,
      buildMarketReviewStateFromSnapshot,
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

  const logMarketReviewGasAccountDecision = useCallback(() => {
    const snapshot = reviewExecutionSnapshotRef.current;
    if (snapshot?.kind !== 'swap' || !snapshot.gasAccountAnalyticsContext) {
      return;
    }

    if (!gasAccountDecisionSnapshotsRef.current.has(snapshot)) {
      gasAccountDecisionSnapshotsRef.current.add(snapshot);
      logDirectSwapGasAccountDecision(snapshot.gasAccountAnalyticsContext);
    }
    return snapshot.gasAccountAnalyticsContext;
  }, []);

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
      // TRON fee includes dynamic resource rental that only TxFeeInfo's
      // own polling can detect. Skip the pre-estimate entirely so we don't
      // pay the RPC roundtrip and so isLastSwapTxWithFeeInfo doesn't trip.
      const isTronTx = networkUtils.isTronNetworkByNetworkId(networkId);
      const canAttachPresetFeeInfo =
        !isTronTx &&
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

      if (
        !snapshot.swapInfo.sender.token.isStock &&
        !snapshot.swapInfo.receiver.token.isStock
      ) {
        return snapshot.quoteResult;
      }

      throw new OneKeyLocalError('Market quote sign payload missing.');
    },
    [],
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
        if (isMarketUserCancelledError(error)) {
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
            customPriorityFee,
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
          customPriorityFee,
          gasAccountAnalytics: {
            fiatCurrency: settingsAtom.currencyInfo.id,
            nativeBalance: snapshot.gasAccountAnalyticsNativeBalance,
            useGasAccountByDefault: settingsAtom.useGasAccountByDefault,
          },
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
        if (isMarketUserCancelledError(error)) {
          onCancel?.();
          return;
        }
        // Sponsored broadcast failed at the gas-account layer: show the mapped
        // sponsor message (sponsor unavailable / quote expired …) before
        // surfacing the failure. Plain errors fall through unchanged.
        const gasAccountEntry = getGasAccountErrorEntry(
          getGasAccountErrorCode(error),
        );
        if (gasAccountEntry) {
          // Mute the rethrown bridge error so the global handler doesn't toast
          // again (would duplicate the mapped message).
          (error as IOneKeyError).autoToast = false;
          // Honor the suppressToast contract (e.g. daily-limit codes stay
          // silent and fall back to user-paid without a quota toast).
          if (!gasAccountEntry.suppressToast) {
            Toast.error({
              title: intl.formatMessage({ id: gasAccountEntry.messageKey }),
            });
          }
        }
        throw error;
      }
    },
    [
      buildMarketApproveUnsignedTxArr,
      assertLatestFromTokenBalanceSufficient,
      cancelSpeedSwapBuildTx,
      handleMarketSwapBuildTxSuccess,
      intl,
      logMarketCreateOrder,
      openMarketFallbackTxConfirm,
      requireReviewExecutionSnapshot,
      settingsAtom.currencyInfo.id,
      settingsAtom.useGasAccountByDefault,
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

      try {
        await assertLatestWrappedExecutionBalancesSufficient({
          snapshot,
          gasInfos,
        });

        if (snapshot.shouldFallback) {
          setSpeedSwapBuildTxLoading(true);

          await openMarketFallbackTxConfirm({
            accountAddress: snapshot.accountAddress,
            accountId: snapshot.accountId,
            buildUnsignedParams: snapshot.buildUnsignedParams,
            networkFeeLevel,
            networkId: snapshot.networkId,
            customPriorityFee,
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
          customPriorityFee,
          validateFinalGasInfos: (finalGasInfos) =>
            assertLatestWrappedExecutionBalancesSufficient({
              snapshot,
              gasInfos: finalGasInfos,
            }),
        });
        const result = await handleMarketSwapBuildTxSuccess(data);
        if (result) {
          onBroadcast?.(result);
        }
      } catch (error) {
        cancelSpeedSwapBuildTx();
        if (isMarketUserCancelledError(error)) {
          onCancel?.();
          return;
        }
        // Same sponsor-error mapping as sendMarketSwapTx: Fallback codes were
        // already resent user-paid inside sendMarketDirectUnsignedTxs, so only
        // Refresh/Hint reach here — surface the mapped message before failing.
        const gasAccountEntry = getGasAccountErrorEntry(
          getGasAccountErrorCode(error),
        );
        if (gasAccountEntry) {
          (error as IOneKeyError).autoToast = false;
          if (!gasAccountEntry.suppressToast) {
            Toast.error({
              title: intl.formatMessage({ id: gasAccountEntry.messageKey }),
            });
          }
        }
        throw error;
      }
    },
    [
      assertLatestWrappedExecutionBalancesSufficient,
      cancelSpeedSwapBuildTx,
      handleMarketSwapBuildTxSuccess,
      intl,
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
        const buildRes = await backgroundApiProxy.serviceSwap.fetchBuildTx({
          fromToken: snapshot.swapInfo.sender.token,
          toToken: snapshot.swapInfo.receiver.token,
          fromTokenAmount:
            signedQuoteResult.fromAmount ?? snapshot.swapInfo.sender.amount,
          toTokenAmount:
            signedQuoteResult.toAmount ?? snapshot.swapInfo.receiver.amount,
          provider: signedQuoteResult.info.provider,
          userAddress: snapshot.accountAddress,
          receivingAddress: snapshot.swapInfo.receivingAddress,
          slippagePercentage: signedQuoteResult.slippage ?? slippage,
          quoteResultCtx: signedQuoteResult.quoteResultCtx,
          accountId: snapshot.accountId,
          protocol: signedQuoteResult.protocol ?? EProtocolOfExchange.SWAP,
          kind: signedQuoteResult.kind ?? ESwapQuoteKind.SELL,
          tradeSource: ESwapTradeSource.MARKET_DEX,
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
        if (isMarketUserCancelledError(error)) {
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
            customPriorityFee,
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
          customPriorityFee,
          onBroadcast,
          onCancel,
        });
      } catch (error) {
        setInAppNotificationAtom((prev) => ({
          ...prev,
          speedSwapApprovingLoading: false,
        }));
        if (isMarketUserCancelledError(error)) {
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
        setBalance(undefined);
        return;
      }

      const currentRequestId = balanceRequestIdRef.current + 1;
      balanceRequestIdRef.current = currentRequestId;
      setBalance(undefined);
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

        const balanceParsed = tokenDetail?.[0]?.balanceParsed;
        setBalance(parseMarketTokenBalance(balanceParsed));
      } catch (_e) {
        if (currentRequestId !== balanceRequestIdRef.current) {
          return;
        }

        setBalance(undefined);
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
    const fromTokenPriceCurrency =
      tradeType === ESwapDirection.BUY ? currentCurrencyId : fromToken.currency;
    const toTokenPriceCurrency =
      tradeType === ESwapDirection.SELL ? currentCurrencyId : toToken.currency;
    const canUseInlinePriceCurrencies =
      (!fromTokenPriceCurrency && !toTokenPriceCurrency) ||
      (!!fromTokenPriceCurrency &&
        !!toTokenPriceCurrency &&
        fromTokenPriceCurrency === toTokenPriceCurrency);
    const canUseInlineTokenPrices =
      canUseInlinePriceCurrencies &&
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
    currentCurrencyId,
    tradeType,
    fromToken.currency,
    fromToken.price,
    fromToken.symbol,
    fromToken.networkId,
    fromToken.contractAddress,
    toToken.currency,
    toToken.price,
    toToken.symbol,
    toToken.networkId,
    toToken.contractAddress,
  ]);

  useEffect(() => {
    const isFromTokenReady = Boolean(
      fromToken.networkId && (fromToken.isNative || fromToken.contractAddress),
    );
    const isToTokenReady = Boolean(
      toToken.networkId && (toToken.isNative || toToken.contractAddress),
    );
    if (isFromTokenReady && isToTokenReady) {
      void fetchTokenPrice();
    }
  }, [
    fetchTokenPrice,
    fromToken.isNative,
    fromToken.networkId,
    fromToken.contractAddress,
    toToken.isNative,
    toToken.networkId,
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

  useEffect(() => {
    appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
    appEventBus.on(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
    return () => {
      appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
      cleanQuoteInterval();
      const quoteRequestId = quoteRequestIdRef.current;
      if (quoteRequestId) {
        closeQuoteEvent(quoteRequestId);
      }
      void resetQuoteAction();
    };
  }, [
    cleanQuoteInterval,
    closeQuoteEvent,
    quoteEventHandler,
    resetQuoteAction,
  ]);

  useEffect(() => {
    setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
    setSwapFromToken(fromTokenRef.current);
    setSwapToToken(toTokenRef.current);
    setManualSelectQuoteProvider(undefined);
  }, [
    fromToken.contractAddress,
    fromToken.networkId,
    setManualSelectQuoteProvider,
    setSwapFromToken,
    setSwapToToken,
    setSwapTypeSwitch,
    toToken.contractAddress,
    toToken.networkId,
  ]);

  useEffect(() => {
    const fromTokenAmountDebouncedBN = new BigNumber(
      fromTokenAmountDebounced || 0,
    );
    const userAddress = netAccountRes.result?.addressDetail.address;
    const accountId = netAccountRes.result?.id;
    setSwapFromTokenAmount({
      value: fromTokenAmountDebounced,
      isInput: true,
    });
    // Read only as a re-run trigger. The quote request remains authoritative
    // for whether trading is available.
    void stockIsOpen;
    if (
      !fromTokenAmountDebouncedBN.isNaN() &&
      fromTokenAmountDebouncedBN.gt(0) &&
      userAddress &&
      accountId &&
      !isWrapped
    ) {
      void quoteAction(
        {
          key: ESwapSlippageSegmentKey.CUSTOM,
          value: slippage,
        },
        userAddress,
        accountId,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
        undefined,
        userAddress,
        undefined,
        {
          fromToken: fromTokenRef.current,
          toToken: toTokenRef.current,
          fromTokenAmount: fromTokenAmountDebounced,
          type: ESwapTabSwitchType.SWAP,
          source: ESwapQuoteSource.MARKET,
        },
      );
    } else {
      const quoteRequestId = quoteRequestIdRef.current;
      if (quoteRequestId) {
        closeQuoteEvent(quoteRequestId);
      }
      void resetQuoteAction();
    }
  }, [
    closeQuoteEvent,
    fromToken.contractAddress,
    fromToken.networkId,
    fromTokenAmountDebounced,
    isWrapped,
    netAccountRes.result?.addressDetail.address,
    netAccountRes.result?.id,
    quoteAction,
    resetQuoteAction,
    setSwapFromTokenAmount,
    slippage,
    stockIsOpen,
    toToken.contractAddress,
    toToken.networkId,
  ]);

  useEffect(() => {
    const amountBN = new BigNumber(fromTokenAmountDebounced || 0);
    if (
      selectedQuoteResult?.allowanceResult?.allowanceTarget &&
      !amountBN.isNaN() &&
      amountBN.gt(0)
    ) {
      void checkTokenApproveAllowance(
        amountBN.toFixed(),
        selectedQuoteResult.allowanceResult.allowanceTarget,
      );
    } else {
      setShouldApprove(false);
      setShouldResetApprove(false);
    }
  }, [
    checkTokenApproveAllowance,
    fromTokenAmountDebounced,
    inAppNotificationAtom.speedSwapApprovingTransaction?.status,
    selectedQuoteResult?.allowanceResult?.allowanceTarget,
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
    paymentTokenPrice: effectiveTradeTokenPrice.gt(0)
      ? effectiveTradeTokenPrice
      : undefined,
    priceRate: selectedQuoteResult?.instantRate
      ? {
          rate: Number(selectedQuoteResult.instantRate),
          fromTokenSymbol: selectedQuoteResult.fromTokenInfo.symbol,
          toTokenSymbol: selectedQuoteResult.toTokenInfo.symbol,
          loading: quoteFetching,
        }
      : priceRate,
    quoteResult: selectedQuoteResult,
    quoteList,
    quoteFetching,
    isWrapped,
    quoteError: quoteEventError?.message ?? selectedQuoteResult?.errorMessage,
    quoteReadyForReview: quoteActionState.canReview,
    quoteNeedsRefresh: quoteActionState.canRefresh,
    refreshMarketQuote,
    estimateMarketPresetNetworkFees,
    prepareMarketSwapReview,
    rebuildMarketSwapReview,
    logMarketReviewGasAccountDecision,
    sendMarketApproveTx,
    sendMarketSwapTx,
    sendMarketWrappedTx,
    sendMarketSignMessage,
    buildMarketApproveInfos: buildMarketApproveInfosForReview,
  };
}
