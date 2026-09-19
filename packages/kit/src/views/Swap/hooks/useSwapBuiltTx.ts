import { useCallback, useMemo, useRef } from 'react';

import {
  OrderBalance,
  hashify,
  normalizeBuyTokenBalance,
  timestamp,
} from '@cowprotocol/contracts';
import BigNumber from 'bignumber.js';
import { cloneDeep, isEqual, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Toast,
  rootNavigationRef,
  useIsOverlayPage,
} from '@onekeyhq/components';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  useCurrencyPersistAtom,
  useInAppNotificationAtom,
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IApproveInfo,
  IBuildUnsignedTxParams,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import {
  BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyAppError, OneKeyError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapEventAPIStatus } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EScanQrCodeModalPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import { createLazySdkLoader } from '@onekeyhq/shared/src/utils/lazySdkLoader';
import { applyCustomPriorityFeeToGasInfo } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  numberFormat,
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IEstimateFeeParams,
  IEstimateGasResp,
  IFeeAlgo,
  IFeeCkb,
  IFeeDot,
  IFeeInfoUnit,
  IFeeSol,
  IFeeSui,
  IFeeTron,
  IFeeUTXO,
  IGasAccountQuote,
  IGasEIP1559,
  IGasLegacy,
  IGasPayer,
} from '@onekeyhq/shared/types/fee';
import {
  EMessageTypesEth,
  ESigningScheme,
} from '@onekeyhq/shared/types/message';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import {
  EInternalDappEnum,
  type IStakeTx,
} from '@onekeyhq/shared/types/staking';
import type {
  ESwapCancelLimitOrderSource,
  IFetchBuildTxResponse,
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  IOneInchOrderStruct,
  IQuoteResultFeeOtherFeeInfo,
  ISwapGasInfo,
  ISwapPreSwapData,
  ISwapReviewSession,
  ISwapStep,
  ISwapToken,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  ESwapNetworkFeeLevel,
  ESwapQuoteKind,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
  EWrappedType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISendTxBaseParams,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '../../../hooks/useSignatureConfirm';
import {
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapLimitExpirationTimeAtom,
  useSwapLimitPartiallyFillAtom,
  useSwapLimitPriceFromAmountAtom,
  useSwapLimitPriceToAmountAtom,
  useSwapProInputAmountAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteListAtom,
  useSwapStepNetFeeLevelAtom,
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { EGasAccountErrorStrategy } from '../../SignatureConfirm/constants/gasAccountErrorCodes';
import { buildSwapApproveAndSendSteps } from '../utils/buildSwapReviewState';
import {
  buildDirectSwapGasAccountAnalyticsContext,
  buildDirectSwapGasAccountUiState,
  createGasAccountReviewSession,
  logDirectSwapGasAccountDecision,
  logGasAccountReviewExit,
  markGasAccountReviewSubmitted,
  runDirectSwapGasAccountStep,
  sendDirectSwapWithGasAccountAnalytics,
} from '../utils/gasAccountAnalytics';
import {
  type ISwapBtcOutputValidationError,
  buildNativeTokenFromGasInfo,
  checkSwapLatestBalanceSufficient,
  getSwapEncodedTxSize,
  getSwapRequiredNativeBalanceAmount,
  validateSwapBtcOutputs,
} from '../utils/swapBalanceUtils';
import { isSwapGasSponsored } from '../utils/swapGasUtils';
import { buildSwapRateDifference } from '../utils/swapRateDifferenceUtils';
import {
  buildSwapReviewPreparationFreshnessFingerprint,
  buildSwapReviewSessionFingerprint,
  canReuseSwapReviewPreparedBuild,
  createSwapReviewPreparationArtifact,
  resolveSwapReviewPreparationCapability,
} from '../utils/swapReviewPreparationV2';
import {
  type ISwapStepSignAndSendProgress,
  buildCustomSlippageQuoteResultCtx,
  buildRebuiltSwapReviewQuoteResult,
  markSubmittedSwapApprovalsCompleted,
  resolveSwapReviewNeedFetchGasAfterRebuild,
  shouldFallbackSwapStep,
} from '../utils/swapReviewState';
import {
  getStockTradeAnalyticsPayload,
  getSwapAnalyticsCategoryFromSwapType,
  getSwapTradeSource,
} from '../utils/swapStockAnalytics';
import { getSwapExecutionTypeFromQuoteResult } from '../utils/swapTypeUtils';

import {
  completeBroadcastedSwapSuccess,
  completeSignedNoSendSwapSuccess,
  persistBroadcastedSendHistory,
} from './swapBroadcastSuccess';
import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapBuildTxInfo, useSwapProAccount } from './useSwapPro';
import {
  useSwapActionState,
  useSwapSlippagePercentageModeInfo,
} from './useSwapState';
import { useSwapTxHistoryActions } from './useSwapTxHistory';

const getEthers = createLazySdkLoader(() => import('ethers'));

const formatter: INumberFormatProps = {
  formatter: 'balance',
};

type ISwapGasFeeInfo = {
  encodeTx: IEncodedTx;
  gasInfo: ISwapGasInfo;
  txSize?: number;
};

type ISwapSendTxResult = ISignedTxPro & {
  gasFeeFiatValue?: string;
  gasFeeInNative?: string;
  isNetworkFeeSponsored?: boolean;
};

type IEstimateNetworkFeeResult = {
  fallbackToSeparateTxConfirm?: boolean;
  netWorkFee?: ISwapPreSwapData['netWorkFee'];
};

type IBuildSwapActionOptions = {
  skipLoading?: boolean;
  forceRebuild?: boolean;
  slippagePercentage?: number;
  useCustomSlippage?: boolean;
  updateReviewState?: boolean;
  preparationPhase?: 'review' | 'execution';
};

type IEstimateNetworkFeeOptions = {
  updateReviewState?: boolean;
};

type IUseSwapBuildTxOptions = {
  onSwapBroadcast?: () => void | Promise<void>;
  marketSwapApprovalFlowId?: string;
};

type ISwapSignAndSendProgressEvent = {
  stage: 'entered' | 'succeeded';
  isApprove: boolean;
};

type ISwapSignAndSendProgressCallback = (
  event: ISwapSignAndSendProgressEvent,
) => void;

type ISwapExecutionContextGuard = {
  assertCurrent: () => void;
  isCurrent: (current?: {
    preSwapData: ISwapPreSwapData;
    quoteResult?: IFetchQuoteResult;
  }) => boolean;
};

function buildSwapFeeRequestId(
  preSwapData: ISwapPreSwapData,
  phase: 'preview' | 'execution',
): string | undefined {
  const session = preSwapData.reviewSession;
  if (!session) {
    return undefined;
  }
  return `swap:${session.sessionId}:${session.revision}:${phase}`;
}

function buildSwapFeeSelectionFingerprint({
  networkFeeLevel,
  customPriorityFee,
}: {
  networkFeeLevel?: ESwapNetworkFeeLevel;
  customPriorityFee?: unknown;
}): string {
  return stableStringify({
    customPriorityFee: customPriorityFee ?? null,
    networkFeeLevel: networkFeeLevel ?? null,
  });
}

function buildSwapFeeFreshnessFingerprint({
  encodedTx,
  transferInfo,
  feeSelectionFingerprint,
}: {
  encodedTx?: unknown;
  transferInfo?: unknown;
  feeSelectionFingerprint: string;
}): string | undefined {
  if (typeof encodedTx === 'undefined') {
    return undefined;
  }

  return stableStringify({
    encodedTx,
    feeSelectionFingerprint,
    transferInfo: transferInfo ?? null,
  });
}

function isCurrentSwapReviewContext({
  current,
  expectedQuoteResult,
  expectedSession,
  expectedSessionFingerprint,
}: {
  current: {
    preSwapData: ISwapPreSwapData;
    quoteResult?: IFetchQuoteResult;
  };
  expectedQuoteResult?: IFetchQuoteResult;
  expectedSession?: ISwapReviewSession;
  expectedSessionFingerprint?: string;
}) {
  const currentSession = current.preSwapData.reviewSession;
  if (expectedSession || currentSession) {
    if (
      !expectedSession ||
      !currentSession ||
      currentSession.sessionId !== expectedSession.sessionId ||
      currentSession.revision !== expectedSession.revision
    ) {
      return false;
    }
    if (
      expectedSessionFingerprint &&
      buildSwapReviewSessionFingerprint(currentSession) !==
        expectedSessionFingerprint
    ) {
      return false;
    }
  }

  return current.quoteResult === expectedQuoteResult;
}

function buildSwapBuildIdentityFingerprint(
  session: ISwapPreSwapData['reviewSession'],
  slippagePercentage: number,
): string | undefined {
  if (!session) {
    return undefined;
  }
  return buildSwapReviewSessionFingerprint({
    ...session,
    slippage: slippagePercentage,
  });
}

function hasCommittedSwapBuildSideEffects(
  buildResult?: IFetchBuildTxResponse,
): boolean {
  const context = buildResult?.ctx as
    | {
        changeHeroOrderId?: unknown;
        cowSwapOrderId?: unknown;
        depositAddress?: unknown;
        depositChannel?: unknown;
        invoice?: unknown;
        oneInchFusionOrderHash?: unknown;
        orderHash?: unknown;
        orderId?: unknown;
        payinAddress?: unknown;
        providerOrderId?: unknown;
      }
    | undefined;

  return Boolean(
    buildResult?.orderId ||
    buildResult?.swftOrder ||
    buildResult?.changellyOrder ||
    buildResult?.thorSwapCallData ||
    context?.cowSwapOrderId ||
    context?.oneInchFusionOrderHash ||
    context?.changeHeroOrderId ||
    context?.orderId ||
    context?.orderHash ||
    context?.providerOrderId ||
    context?.depositAddress ||
    context?.depositChannel ||
    context?.payinAddress ||
    context?.invoice ||
    buildResult?.result.swapShouldSignedData,
  );
}

function canReuseSwapReviewExecutionFee({
  preSwapData,
  encodedTx,
  transfersInfo,
  needFetchGas,
  isGasAccountEnabled,
  feeSelectionFingerprint,
}: {
  preSwapData: ISwapPreSwapData;
  encodedTx?: IEncodedTx;
  transfersInfo?: unknown;
  needFetchGas?: boolean;
  isGasAccountEnabled: boolean;
  feeSelectionFingerprint?: string;
}): boolean {
  if (needFetchGas || isGasAccountEnabled) {
    return false;
  }

  const session = preSwapData.reviewSession;
  if (!session) {
    return false;
  }

  const buildResult = preSwapData.swapBuildResultData;
  const feeSnapshot = preSwapData.netWorkFee;
  const artifact = preSwapData.preparationArtifact;
  if (!buildResult || !feeSnapshot || !artifact) {
    return false;
  }

  const feeFreshnessFingerprint = buildSwapFeeFreshnessFingerprint({
    encodedTx,
    feeSelectionFingerprint: feeSelectionFingerprint ?? '',
    transferInfo: transfersInfo,
  });
  const buildFreshnessFingerprint =
    buildSwapReviewPreparationFreshnessFingerprint({
      encodedTx: buildResult.encodedTx,
      transferInfo: buildResult.transferInfo,
    });
  const canReusePreparedBuild = canReuseSwapReviewPreparedBuild({
    artifact,
    capability: preSwapData.preparationCapability,
    identity: session,
    now: Date.now(),
    freshnessFingerprint: buildFreshnessFingerprint,
    encodedTx: buildResult.encodedTx,
    sideEffectsCommitted: buildResult.sideEffectsCommitted,
  });

  return Boolean(
    canReusePreparedBuild &&
    feeSnapshot.sessionId === session.sessionId &&
    feeSnapshot.revision === session.revision &&
    feeSnapshot.identityFingerprint === buildResult.identityFingerprint &&
    feeSnapshot.freshnessFingerprint === feeFreshnessFingerprint &&
    feeSnapshot.feeSelectionFingerprint === feeSelectionFingerprint,
  );
}

function canFallbackToSeparateTxConfirm({
  buildUnsignedParams,
  approveUnsignedTxArr,
}: {
  buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams;
  approveUnsignedTxArr?: IUnsignedTxPro[];
}) {
  return Boolean(
    approveUnsignedTxArr?.length &&
    (buildUnsignedParams.encodedTx ||
      buildUnsignedParams.transfersInfo?.length),
  );
}

function getSwapCreateFrom({
  isSwapPro,
  isModalPage,
}: {
  isSwapPro: boolean;
  isModalPage: boolean;
}) {
  if (isSwapPro) {
    return 'swapPro';
  }
  if (isModalPage) {
    return 'modal';
  }
  return 'swapPage';
}

/**
 * React hook that manages the full lifecycle of building, approving, signing, and sending swap transactions in a multi-step workflow.
 *
 * Integrates with background APIs, handles UI state updates, fee checks, error handling, and event logging for swap operations. Supports various swap protocols, approval flows, limit order cancellation, and fallback UI confirmations. Returns functions to start the swap steps execution and to cancel limit orders.
 *
 * @returns An object with `preSwapStepsStart` to initiate the swap steps process and `cancelLimitOrder` to cancel a limit order.
 */
export function useSwapBuildTx({
  onSwapBroadcast,
  marketSwapApprovalFlowId,
}: IUseSwapBuildTxOptions = {}) {
  const onSwapBroadcastRef = useRef(onSwapBroadcast);
  onSwapBroadcastRef.current = onSwapBroadcast;
  const intl = useIntl();
  const {
    currentQuoteRes: selectQuote,
    fromSelectToken: fromToken,
    toSelectToken: toToken,
  } = useSwapBuildTxInfo();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [, setInAppNotificationAtom] = useInAppNotificationAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const swapProAccount = useSwapProAccount();
  const focusSwapPro = useMemo(() => {
    return Boolean(
      platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT,
    );
  }, [swapTypeSwitch]);
  const fromUserAddress = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.addressDetail.address;
    }
    return swapFromAddressInfo.address;
  }, [
    focusSwapPro,
    swapProAccount.result?.addressDetail.address,
    swapFromAddressInfo.address,
  ]);
  const toUserAddress = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.addressDetail.address;
    }
    return swapToAddressInfo.address;
  }, [
    focusSwapPro,
    swapProAccount.result?.addressDetail.address,
    swapToAddressInfo.address,
  ]);
  const fromAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.id;
    }
    return swapFromAddressInfo.accountInfo?.account?.id;
  }, [
    focusSwapPro,
    swapProAccount.result?.id,
    swapFromAddressInfo.accountInfo?.account?.id,
  ]);
  const toAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.id;
    }
    return swapToAddressInfo.accountInfo?.account?.id;
  }, [
    focusSwapPro,
    swapProAccount.result?.id,
    swapToAddressInfo.accountInfo?.account?.id,
  ]);
  const fromAccountIndexedAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.indexedAccountId;
    }
    return swapFromAddressInfo.accountInfo?.indexedAccount?.id;
  }, [
    focusSwapPro,
    swapProAccount.result?.indexedAccountId,
    swapFromAddressInfo.accountInfo?.indexedAccount?.id,
  ]);
  const fromAccountNetworkId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.addressDetail.networkId;
    }
    return swapFromAddressInfo.networkId;
  }, [
    focusSwapPro,
    swapProAccount.result?.addressDetail.networkId,
    swapFromAddressInfo.networkId,
  ]);
  const dbAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.id;
    }
    return swapFromAddressInfo.accountInfo?.dbAccount?.id;
  }, [
    focusSwapPro,
    swapFromAddressInfo.accountInfo?.dbAccount?.id,
    swapProAccount.result?.id,
  ]);
  const { generateSwapHistoryItem } = useSwapTxHistoryActions();
  const [swapLimitExpirationTime] = useSwapLimitExpirationTimeAtom();
  const [swapLimitPriceFromAmount] = useSwapLimitPriceFromAmountAtom();
  const [swapLimitPriceToAmount] = useSwapLimitPriceToAmountAtom();
  const [swapLimitPartiallyFillObj] = useSwapLimitPartiallyFillAtom();
  const [swapSteps, setSwapSteps] = useSwapStepsAtom();
  const [persistSettings, setPersistSettings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { isFirstTimeSwap } = persistSettings;
  const swapActionState = useSwapActionState();
  const [swapNetWorkFeeLevel] = useSwapStepNetFeeLevelAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapToTokenAmount] = useSwapToTokenAmountAtom();
  const [, setSwapQuoteResultList] = useSwapQuoteListAtom();
  const [, setSwapProFromAmount] = useSwapProInputAmountAtom();
  const [, setSwapQuoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [, setSettings] = useSettingsAtom();
  const { navigationToMessageConfirm, navigationToTxConfirm } =
    useSignatureConfirm({
      accountId: fromAccountId ?? '',
      networkId: fromAccountNetworkId ?? '',
    });

  const swapStepsRef = useRef(swapSteps);
  const swapNetworkFeeLevelRef = useRef(swapNetWorkFeeLevel);
  const rebuildSwapRequestIdRef = useRef(0);
  if (swapStepsRef.current !== swapSteps) {
    swapStepsRef.current = swapSteps;
  }
  swapNetworkFeeLevelRef.current = swapNetWorkFeeLevel;
  const gasAccountReviewSessionRef = useRef<
    ReturnType<typeof createGasAccountReviewSession> | undefined
  >(undefined);

  const beginGasAccountReviewSession = useCallback(() => {
    gasAccountReviewSessionRef.current = createGasAccountReviewSession();
  }, []);

  const endGasAccountReviewSession = useCallback(() => {
    logGasAccountReviewExit(gasAccountReviewSessionRef.current);
    gasAccountReviewSessionRef.current = undefined;
  }, []);

  const markCurrentGasAccountReviewSubmitted = useCallback(() => {
    markGasAccountReviewSubmitted(gasAccountReviewSessionRef.current);
  }, []);

  const isModalPage = useIsOverlayPage();

  const buildSeparateApproveAndSwapSteps = useCallback(
    (quoteResult?: IFetchQuoteResult) =>
      buildSwapApproveAndSendSteps({
        quoteResult,
        texts: {
          approveAndSwap: intl.formatMessage({
            id: ETranslations.swap_page_approve_and_swap,
          }),
          revokeApprove: intl.formatMessage(
            {
              id: ETranslations.global_revoke_approve,
            },
            {
              symbol: quoteResult?.fromTokenInfo.symbol ?? fromToken?.symbol,
            },
          ),
          approveTokenWithTarget: intl.formatMessage(
            {
              id: ETranslations.swap_page_approve_button,
            },
            {
              token: quoteResult?.fromTokenInfo.symbol ?? fromToken?.symbol,
              target: quoteResult?.info.providerName,
            },
          ),
          confirmSwap: intl.formatMessage({
            id: ETranslations.swap_review_confirm_swap,
          }),
          swap: intl.formatMessage({
            id: ETranslations.global_swap,
          }),
        },
      }),
    [fromToken?.symbol, intl],
  );

  const syncRecentTokenPairs = useCallback(
    async ({
      swapFromToken,
      swapToToken,
    }: {
      swapFromToken: ISwapToken;
      swapToToken: ISwapToken;
    }) => {
      await backgroundApiProxy.serviceSwap.swapRecentTokenPairsUpdate({
        fromToken: swapFromToken,
        toToken: swapToToken,
      });
    },
    [],
  );

  const clearQuoteData = useCallback(() => {
    setSwapFromTokenAmount({
      value: '',
      isInput: false,
    }); // send success, clear from token amount
    setSwapToTokenAmount({
      value: '',
      isInput: false,
    }); // send success, clear to token amount
    setSwapProFromAmount('');
    setSwapQuoteResultList([]);
    setSwapQuoteEventTotalCount({
      count: 0,
    });
    setSettings((v) => ({
      // reset account switch for reset swap receive address
      ...v,
      swapToAnotherAccountSwitchOn: false,
    }));
  }, [
    setSettings,
    setSwapFromTokenAmount,
    setSwapQuoteEventTotalCount,
    setSwapQuoteResultList,
    setSwapToTokenAmount,
    setSwapProFromAmount,
  ]);

  const goBackQrCodeModal = useCallback(() => {
    if (
      rootNavigationRef.current?.canGoBack() &&
      rootNavigationRef.current?.getCurrentRoute()?.name ===
        EScanQrCodeModalPages.ScanQrCodeStack
    ) {
      rootNavigationRef.current?.goBack();
    }
  }, []);

  const onBuildTxSuccess = useCallback(
    async (
      txId: string,
      swapInfo: ISwapTxInfo,
      orderId?: string,
      gasFeeFiatValue?: string,
      gasFeeInNative?: string,
      isNetworkFeeSponsored?: boolean,
      executionContext?: ISwapExecutionContextGuard,
    ) => {
      if (swapInfo) {
        if (executionContext?.isCurrent() ?? true) {
          clearQuoteData();
          setSwapSteps(
            (prevSteps: {
              steps: ISwapStep[];
              preSwapData: ISwapPreSwapData;
              quoteResult?: IFetchQuoteResult | undefined;
            }) => {
              if (executionContext && !executionContext.isCurrent(prevSteps)) {
                return prevSteps;
              }
              const newSteps = [...prevSteps.steps];
              newSteps[newSteps.length - 1] = {
                ...newSteps[newSteps.length - 1],
                status: ESwapStepStatus.PENDING,
                txHash: txId,
                orderId,
              };
              const nextState = {
                ...prevSteps,
                steps: newSteps,
              };
              swapStepsRef.current = nextState;
              return nextState;
            },
          );
        }
        if (
          (executionContext?.isCurrent() ?? true) &&
          accountUtils.isQrAccount({
            accountId: fromAccountId ?? '',
          })
        ) {
          void goBackQrCodeModal();
        }
        await completeBroadcastedSwapSuccess({
          txId,
          swapInfo:
            isNetworkFeeSponsored === undefined
              ? swapInfo
              : { ...swapInfo, isNetworkFeeSponsored },
          gasFeeFiatValue,
          gasFeeInNative,
          generateSwapHistoryItem,
          onSwapBroadcast: onSwapBroadcastRef.current,
        });
        if (
          swapInfo.sender.token.networkId === swapInfo.receiver.token.networkId
        ) {
          void backgroundApiProxy.serviceNotification.blockNotificationForTxId({
            networkId: swapInfo.sender.token.networkId,
            tx: txId,
          });
        }
      }
    },
    [
      clearQuoteData,
      goBackQrCodeModal,
      generateSwapHistoryItem,
      setSwapSteps,
      fromAccountId,
    ],
  );

  const handleBuildTxSuccessWithSignedNoSend = useCallback(
    async ({
      swapInfo,
      orderId,
      executionContext,
    }: {
      orderId?: string;
      swapInfo: ISwapTxInfo;
      executionContext?: ISwapExecutionContextGuard;
    }) => {
      if (swapInfo) {
        if (executionContext?.isCurrent() ?? true) {
          clearQuoteData();
          if (accountUtils.isQrAccount({ accountId: fromAccountId ?? '' })) {
            rootNavigationRef.current?.goBack();
          }
          setSwapSteps(
            (prevSteps: {
              steps: ISwapStep[];
              preSwapData: ISwapPreSwapData;
              quoteResult?: IFetchQuoteResult | undefined;
            }) => {
              if (executionContext && !executionContext.isCurrent(prevSteps)) {
                return prevSteps;
              }
              const newSteps = [...prevSteps.steps];
              newSteps[newSteps.length - 1] = {
                ...newSteps[newSteps.length - 1],
                status: ESwapStepStatus.PENDING,
                orderId,
              };
              const nextState = {
                ...prevSteps,
                steps: newSteps,
              };
              swapStepsRef.current = nextState;
              return nextState;
            },
          );
        }
        await completeSignedNoSendSwapSuccess({
          swapInfo,
          generateSwapHistoryItem,
          onSwapBroadcast: onSwapBroadcastRef.current,
        });
      }
    },
    [clearQuoteData, generateSwapHistoryItem, setSwapSteps, fromAccountId],
  );

  const getSwapBalanceInsufficientToast = useCallback(
    ({
      networkId,
      tokenSymbol,
      reserveAmount,
    }: {
      networkId?: string;
      tokenSymbol: string;
      reserveAmount?: string;
    }) => {
      const isBtcNetwork = networkUtils.isBTCNetwork(networkId);
      return {
        title: isBtcNetwork
          ? intl.formatMessage({
              id: ETranslations.send_toast_btc_fork_insufficient_fund,
            })
          : intl.formatMessage(
              {
                id: ETranslations.swap_page_toast_insufficient_balance_title,
              },
              { token: tokenSymbol },
            ),
        message:
          !isBtcNetwork && reserveAmount
            ? intl.formatMessage(
                {
                  id: ETranslations.swap_page_toast_insufficient_balance_content,
                },
                {
                  token: tokenSymbol,
                  number: numberFormat(reserveAmount, formatter),
                },
              )
            : undefined,
      };
    },
    [intl],
  );

  const getSwapBtcOutputValidationToast = useCallback(
    ({
      networkId,
      tokenSymbol,
      validationError,
    }: {
      networkId?: string;
      tokenSymbol: string;
      validationError: ISwapBtcOutputValidationError;
    }) => {
      if (validationError.type === 'payment_output_less_than_order_amount') {
        return getSwapBalanceInsufficientToast({
          networkId,
          tokenSymbol,
        });
      }

      return {
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_swap_failed,
        }),
        message: intl.formatMessage({
          id: ETranslations.global_unknown_error_retry_message,
        }),
      };
    },
    [getSwapBalanceInsufficientToast, intl],
  );

  const checkOtherFee = useCallback(
    async (quoteResult: IFetchQuoteResult) => {
      const otherFeeInfo = quoteResult?.fee?.otherFeeInfos;
      let checkRes = true;
      if (otherFeeInfo?.length) {
        await Promise.all(
          otherFeeInfo.map(async (item) => {
            const shouldAddFromAmount = equalTokenNoCaseSensitive({
              token1: item.token,
              token2: fromToken,
            });
            const tokenAmountBN = new BigNumber(item.amount ?? 0);
            const fromTokenAmountBN = new BigNumber(
              selectQuote?.fromAmount ?? 0,
            );
            const finalTokenAmount = shouldAddFromAmount
              ? tokenAmountBN.plus(fromTokenAmountBN).toFixed()
              : tokenAmountBN.toFixed();
            const checkResult = await checkSwapLatestBalanceSufficient({
              token: item.token,
              amount: finalTokenAmount,
              accountAddress: fromUserAddress,
              accountId: fromAccountId,
            });
            if (!checkResult.isSufficient) {
              Toast.error({
                ...getSwapBalanceInsufficientToast({
                  networkId: item.token.networkId,
                  tokenSymbol: checkResult.tokenSymbol,
                  reserveAmount: tokenAmountBN.toFixed(),
                }),
              });
              checkRes = false;
            }
          }),
        );
      }
      return checkRes;
    },
    [
      fromToken,
      selectQuote?.fromAmount,
      fromUserAddress,
      fromAccountId,
      getSwapBalanceInsufficientToast,
    ],
  );

  const showLatestBalanceInsufficientToast = useCallback(
    (networkId: string | undefined, tokenSymbol: string) => {
      Toast.error({
        ...getSwapBalanceInsufficientToast({
          networkId,
          tokenSymbol,
        }),
      });
    },
    [getSwapBalanceInsufficientToast],
  );

  const checkLatestFromTokenBalance = useCallback(
    async (token: ISwapToken, amount: string) => {
      const checkResult = await checkSwapLatestBalanceSufficient({
        token,
        amount,
        accountAddress: fromUserAddress,
        accountId: fromAccountId,
      });
      if (!checkResult.isSufficient) {
        showLatestBalanceInsufficientToast(
          token.networkId,
          checkResult.tokenSymbol,
        );
        return false;
      }
      return true;
    },
    [fromAccountId, fromUserAddress, showLatestBalanceInsufficientToast],
  );

  const checkLatestNativeTokenBalance = useCallback(
    async ({
      gasInfos,
      networkId,
      token,
      amount,
      otherFeeInfos,
      cachedNativeBalance,
    }: {
      gasInfos?: { gasInfo?: ISwapGasInfo; txSize?: number }[];
      networkId?: string;
      token?: ISwapToken;
      amount?: string;
      otherFeeInfos?: IQuoteResultFeeOtherFeeInfo[];
      cachedNativeBalance?: string;
    }) => {
      const nativeBalanceRequirement = getSwapRequiredNativeBalanceAmount({
        gasInfos,
        networkId,
        fromToken: token,
        fromAmount: amount,
        otherFeeInfos,
      });
      if (!nativeBalanceRequirement && cachedNativeBalance !== undefined) {
        return {
          isSufficient: true,
          nativeBalance: cachedNativeBalance,
        };
      }
      const firstGasInfo = gasInfos?.find((item) => item.gasInfo)?.gasInfo;
      const nativeToken =
        nativeBalanceRequirement?.token ??
        (firstGasInfo
          ? buildNativeTokenFromGasInfo({
              gasInfo: firstGasInfo,
              networkId,
              fromToken: token,
            })
          : undefined);
      if (!nativeToken) {
        return { isSufficient: true };
      }

      const checkResult = await checkSwapLatestBalanceSufficient({
        token: nativeToken,
        amount: nativeBalanceRequirement?.amount ?? '0',
        accountAddress: fromUserAddress,
        accountId: fromAccountId,
      });
      if (!checkResult.isSufficient) {
        const toastId = [
          'swap-native-balance-insufficient',
          nativeToken.networkId,
          checkResult.tokenSymbol,
          nativeBalanceRequirement?.reserveAmount,
        ].join('-');
        const { title, message } = getSwapBalanceInsufficientToast({
          networkId: nativeToken.networkId,
          tokenSymbol: checkResult.tokenSymbol,
          reserveAmount: nativeBalanceRequirement?.includesFromAmount
            ? undefined
            : nativeBalanceRequirement?.reserveAmount,
        });
        Toast.error({
          title,
          message,
          toastId,
        });
        return {
          isSufficient: false,
          nativeBalance: checkResult.balance,
        };
      }
      return {
        isSufficient: true,
        nativeBalance: checkResult.balance,
      };
    },
    [fromAccountId, fromUserAddress, getSwapBalanceInsufficientToast],
  );

  const cancelLimitOrder = useCallback(
    async (item: IFetchLimitOrderRes, source: ESwapCancelLimitOrderSource) => {
      if (item.cancelInfo) {
        const { domain, types, data, signedType } = item.cancelInfo;
        const { ethers: ethersLib } = await getEthers();
        const populated = await ethersLib.utils._TypedDataEncoder.resolveNames(
          domain,
          types,
          data,
          async (value: string) => value,
        );
        const dataMessage = JSON.stringify(
          ethersLib.utils._TypedDataEncoder.getPayload(
            populated.domain,
            types,
            populated.value,
          ),
        );
        if (!fromAccountIndexedAccountId && !fromAccountId) {
          throw new OneKeyError('No account found');
        }
        let orderAccount: INetworkAccount | undefined;
        try {
          const defaultDeriveType =
            await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
              {
                networkId: item.networkId,
              },
            );
          orderAccount =
            await backgroundApiProxy.serviceAccount.getNetworkAccount({
              accountId: fromAccountIndexedAccountId
                ? undefined
                : fromAccountId,
              indexedAccountId: fromAccountIndexedAccountId ?? '',
              networkId: item.networkId,
              deriveType: defaultDeriveType ?? 'default',
            });
        } catch (_e) {
          orderAccount = undefined;
        }
        if (dataMessage) {
          const signHash = await new Promise<string>((resolve, reject) => {
            if (dataMessage && item.userAddress && orderAccount) {
              navigationToMessageConfirm({
                accountId: orderAccount.id,
                networkId: item.networkId,
                unsignedMessage: {
                  type: signedType ?? EMessageTypesEth.TYPED_DATA_V4,
                  message: dataMessage,
                  payload: [item.userAddress.toLowerCase(), dataMessage],
                },
                walletInternalSign: true,
                onSuccess: (result: string) => {
                  resolve(result);
                },
                onFail: (error: Error) => {
                  reject(error);
                },
                onCancel: () => {
                  reject(new Error('user cancel'));
                },
              });
            } else {
              reject(
                new Error(
                  `missing data: dataMessage: ${dataMessage ?? ''}, address: ${
                    orderAccount?.addressDetail.address ?? ''
                  }, networkId: ${item.networkId ?? ''}`,
                ),
              );
            }
          });
          if (signHash) {
            await backgroundApiProxy.serviceSwap.cancelLimitOrder({
              orderIds: [item.orderId],
              signature: signHash,
              signingScheme: ESigningScheme.EIP712,
              networkId: item.networkId,
              provider: item.provider,
              userAddress: item.userAddress,
            });
            await backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop(
              fromAccountIndexedAccountId,
              !fromAccountIndexedAccountId
                ? (fromAccountId ?? dbAccountId)
                : undefined,
              true,
            );
            defaultLogger.swap.cancelLimitOrder.cancelLimitOrder({
              cancelFrom: source,
              chain: item.networkId,
              sourceTokenSymbol: item.fromTokenInfo.symbol,
              receivedTokenSymbol: item.toTokenInfo.symbol,
              sellTokenAmount: item.fromAmount,
            });
          }
        }
      }
    },
    [
      fromAccountIndexedAccountId,
      fromAccountId,
      navigationToMessageConfirm,
      dbAccountId,
    ],
  );

  const updateUnsignedTxAndSendTx = useCallback(
    async ({
      stepIndex,
      networkId,
      accountId,
      unsignedTxItem,
      gasInfo,
      isApprove,
      onSignAndSendProgress,
      executionContext,
    }: {
      stepIndex: number;
      networkId: string;
      accountId: string;
      unsignedTxItem: IUnsignedTxPro;
      gasInfo: ISwapGasInfo;
      isApprove: boolean;
      onSignAndSendProgress?: ISwapSignAndSendProgressCallback;
      executionContext?: ISwapExecutionContextGuard;
    }) => {
      executionContext?.assertCurrent();
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
              baseFee: gasInfo.common?.baseFee,
              feeDecimals: gasInfo.common?.feeDecimals,
              feeSymbol: gasInfo.common?.feeSymbol,
              nativeDecimals: gasInfo.common?.nativeDecimals,
              nativeSymbol: gasInfo.common?.nativeSymbol,
              nativeTokenPrice: gasInfo.common?.nativeTokenPrice,
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
      executionContext?.assertCurrent();
      const txSize =
        getSwapEncodedTxSize(updatedUnsignedTxItem.encodedTx) ??
        updatedUnsignedTxItem.txSize ??
        getSwapEncodedTxSize(unsignedTxItem.encodedTx) ??
        unsignedTxItem.txSize;
      const btcOutputValidationError = validateSwapBtcOutputs({
        networkId,
        encodedTx: updatedUnsignedTxItem.encodedTx,
        transferInfo:
          unsignedTxItem.transfersInfo?.[0] ??
          updatedUnsignedTxItem.transfersInfo?.[0],
      });
      if (btcOutputValidationError) {
        const tokenSymbol =
          updatedUnsignedTxItem.swapInfo?.sender.token.symbol ??
          unsignedTxItem.swapInfo?.sender.token.symbol ??
          gasInfo.common?.nativeSymbol ??
          '';
        const validationToast = getSwapBtcOutputValidationToast({
          networkId,
          tokenSymbol,
          validationError: btcOutputValidationError,
        });
        Toast.error({
          ...validationToast,
          toastId: [
            'swap-btc-output-validation',
            networkId,
            tokenSymbol,
            btcOutputValidationError.type,
            btcOutputValidationError.expectedAmountBase ?? '',
            btcOutputValidationError.actualAmountBase ?? '',
          ].join('-'),
        });
        throw new OneKeyAppError(
          [validationToast.title, validationToast.message]
            .filter(Boolean)
            .join(' '),
        );
      }
      const {
        totalNative,
        total,
        totalFiat,
        totalFiatForDisplay,
        totalNativeForDisplay,
      } = calculateFeeForSend({
        feeInfo: gasInfo as IFeeInfoUnit,
        nativeTokenPrice: gasInfo.common?.nativeTokenPrice ?? 0,
        txSize,
      });
      const checkLatestNativeBalanceRes = await checkLatestNativeTokenBalance({
        gasInfos: [{ gasInfo, txSize }],
        networkId,
        token: unsignedTxItem.swapInfo?.sender.token,
        amount: unsignedTxItem.swapInfo?.sender.amount,
        otherFeeInfos:
          unsignedTxItem.swapInfo?.swapBuildResData.result?.fee?.otherFeeInfos,
        cachedNativeBalance: gasAccountReviewSessionRef.current?.nativeBalance,
      });
      executionContext?.assertCurrent();
      const gasAccountAnalyticsContext =
        buildDirectSwapGasAccountAnalyticsContext({
          entryPoint: 'swapDirect',
          networkId,
          unsignedTx: unsignedTxItem,
          gasInfo,
          txSize,
          nativeBalance: checkLatestNativeBalanceRes.nativeBalance,
          useGasAccountByDefault: persistSettings.useGasAccountByDefault,
          fiatCurrency: persistSettings.currencyInfo.id,
        });
      if (!checkLatestNativeBalanceRes.isSufficient) {
        throw new OneKeyAppError('checkLatestNativeTokenBalance failed');
      }
      executionContext?.assertCurrent();
      setSwapSteps(
        (prev: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
          if (executionContext && !executionContext.isCurrent(prev)) {
            return prev;
          }
          const newSteps = cloneDeep(prev.steps);
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            stepSubTitle: intl.formatMessage({
              id: ETranslations.swap_process_sign_and_sent_tx,
            }),
          };
          return {
            ...prev,
            steps: newSteps,
          };
        },
      );
      await runDirectSwapGasAccountStep({
        context: gasAccountAnalyticsContext,
        failureStage: 'precheck',
        task: async () => {
          executionContext?.assertCurrent();
          await backgroundApiProxy.serviceSend.precheckUnsignedTxs({
            networkId,
            accountId,
            unsignedTxs: [updatedUnsignedTxItem],
            precheckTiming: ESendPreCheckTimingEnum.Confirm,
          });
          executionContext?.assertCurrent();
          await backgroundApiProxy.serviceTransaction.verifyTransaction({
            networkId,
            accountId,
            verifyTxTasks: ['feeInfo'],
            verifyTxFeeInfoParams: {
              feeAmount: totalNative,
              feeTokenSymbol: gasInfo.common?.nativeSymbol ?? '',
              doubleConfirm: true,
            },
            encodedTx: updatedUnsignedTxItem.encodedTx,
          });
          executionContext?.assertCurrent();
        },
      });
      executionContext?.assertCurrent();
      const gasAccountUiState = buildDirectSwapGasAccountUiState({
        gasInfo,
        unsignedTx: updatedUnsignedTxItem,
      });
      let isNetworkFeeSponsored = isSwapGasSponsored(gasInfo);
      const sendTxParams = {
        networkId,
        accountId,
        unsignedTx: updatedUnsignedTxItem,
        signOnly: false as const,
        // The direct pipeline never passes through the confirm page's fee
        // footer, so hand the resolved fee to the device stage card here.
        stageFeeInfo: {
          feeInfo: gasInfo as IFeeInfoUnit,
          total,
          totalNative,
          totalFiat,
          totalNativeForDisplay,
          totalFiatForDisplay,
        },
      };
      const res = await sendDirectSwapWithGasAccountAnalytics({
        context: gasAccountAnalyticsContext,
        gasAccountUiState,
        send: (uiState) => {
          executionContext?.assertCurrent();
          onSignAndSendProgress?.({ stage: 'entered', isApprove });
          return backgroundApiProxy.serviceSend.signAndSendTransaction({
            ...sendTxParams,
            gasAccountUiState: uiState,
          });
        },
        onGasAccountError: (error, entry) => {
          (error as IOneKeyError).autoToast = false;
          const message = intl.formatMessage({ id: entry.messageKey });
          if (!entry.suppressToast) {
            Toast.error({ title: message });
          }
          if (entry.strategy === EGasAccountErrorStrategy.Fallback) {
            isNetworkFeeSponsored = false;
            return;
          }
          throw new OneKeyAppError({ message, autoToast: false });
        },
      });
      if (!executionContext || executionContext.isCurrent()) {
        onSignAndSendProgress?.({ stage: 'succeeded', isApprove });
      }
      await persistBroadcastedSendHistory({
        buildDecodedTx: () =>
          backgroundApiProxy.serviceSend.buildDecodedTx({
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
          }),
        saveHistory: (decodedTx) =>
          backgroundApiProxy.serviceHistory.saveSendConfirmHistoryTxs({
            networkId,
            accountId,
            data: {
              signedTx: res,
              decodedTx,
              approveInfo: updatedUnsignedTxItem.approveInfo,
              feeInfo: gasInfo as IFeeInfoUnit,
            },
          }),
      });
      return {
        ...res,
        gasFeeFiatValue: totalFiatForDisplay,
        gasFeeInNative: totalNativeForDisplay,
        isNetworkFeeSponsored,
      };
    },
    [
      checkLatestNativeTokenBalance,
      getSwapBtcOutputValidationToast,
      intl,
      persistSettings.currencyInfo.id,
      persistSettings.useGasAccountByDefault,
      setSwapSteps,
    ],
  );

  const swapEstimateFeeEvent = useCallback(
    (
      status: ESwapEventAPIStatus,
      networkId: string,
      accountId: string,
      message?: string,
      encodedTx?: string,
      swapInfo?: ISwapTxInfo,
      isBatch?: boolean,
    ) => {
      const swapType = getSwapExecutionTypeFromQuoteResult(
        swapInfo?.swapBuildResData.result,
      );
      defaultLogger.swap.swapEstimateFee.swapEstimateFee({
        status,
        message,
        orderId: swapInfo?.swapBuildResData.orderId ?? '',
        swapType,
        slippage: slippageItem.value.toString(),
        router: JSON.stringify(
          swapInfo?.swapBuildResData.result.routesData ?? [],
        ),
        fromNetworkId: swapInfo?.sender.token.networkId ?? '',
        toNetworkId: swapInfo?.receiver.token.networkId ?? '',
        fromTokenSymbol: swapInfo?.sender.token.symbol ?? '',
        toTokenSymbol: swapInfo?.receiver.token.symbol ?? '',
        fromTokenAmount: swapInfo?.sender.amount ?? '',
        toTokenAmount: swapInfo?.receiver.amount ?? '',
        provider: swapInfo?.swapBuildResData.result.info.provider ?? '',
        providerName: swapInfo?.swapBuildResData.result.info.providerName ?? '',
        networkId,
        accountId,
        encodedTx: encodedTx ?? '',
        isBatch,
      });
    },
    [slippageItem.value],
  );

  const swapSendTxEvent = useCallback(
    (
      status: ESwapEventAPIStatus,
      networkId: string,
      accountId: string,
      message?: string,
      encodedTx?: string,
      swapInfo?: ISwapTxInfo,
      quoteResult?: IFetchQuoteResult,
    ) => {
      const swapType = getSwapExecutionTypeFromQuoteResult(
        swapInfo?.swapBuildResData.result,
      );
      defaultLogger.swap.swapSendTx.swapSendTx({
        fromAddress: fromUserAddress ?? '',
        toAddress: toUserAddress ?? '',
        status,
        message,
        orderId: swapInfo?.swapBuildResData.orderId ?? '',
        swapType,
        slippage: slippageItem.value.toString(),
        fromNetworkId: swapInfo?.sender.token.networkId ?? '',
        toNetworkId: swapInfo?.receiver.token.networkId ?? '',
        fromTokenSymbol: swapInfo?.sender.token.symbol ?? '',
        toTokenSymbol: swapInfo?.receiver.token.symbol ?? '',
        fromTokenAmount: swapInfo?.sender.amount ?? '',
        toTokenAmount: swapInfo?.receiver.amount ?? '',
        quoteToTokenAmount: quoteResult?.toAmount ?? '',
        router: JSON.stringify(
          swapInfo?.swapBuildResData.result.routesData ?? [],
        ),
        provider: swapInfo?.swapBuildResData.result.info.provider ?? '',
        providerName: swapInfo?.swapBuildResData.result.info.providerName ?? '',
        networkId,
        accountId,
        encodedTx: encodedTx ?? '',
      });
    },
    [slippageItem.value, fromUserAddress, toUserAddress],
  );

  const handleApproveFallbackOnSuccess = useCallback(
    (
      stepIndex: number,
      res?: ISendTxOnSuccessData[],
      shouldWaitApprove?: boolean,
      executionContext?: ISwapExecutionContextGuard,
    ) => {
      if (res?.[0] && (executionContext?.isCurrent() ?? true)) {
        const transactionSignedInfo = res[0].signedTx;
        const approveInfo = res[0].approveInfo;
        const txId = transactionSignedInfo.txid;
        setInAppNotificationAtom((prev) => {
          if (
            executionContext &&
            !executionContext.isCurrent(swapStepsRef.current)
          ) {
            return prev;
          }
          if (prev.swapApprovingTransaction) {
            return {
              ...prev,
              swapApprovingTransaction: {
                ...prev.swapApprovingTransaction,
                txId,
                status: shouldWaitApprove
                  ? prev.swapApprovingTransaction.status
                  : ESwapApproveTransactionStatus.SUCCESS,
                resetApproveIsMax: !!approveInfo?.isMax,
                ...(approveInfo
                  ? {
                      amount: approveInfo.amount,
                    }
                  : {}),
              },
            };
          }
          return prev;
        });
        if (!shouldWaitApprove) {
          setSwapSteps(
            (prev: {
              steps: ISwapStep[];
              preSwapData: ISwapPreSwapData;
              quoteResult?: IFetchQuoteResult | undefined;
            }) => {
              if (executionContext && !executionContext.isCurrent(prev)) {
                return prev;
              }
              const newSteps = cloneDeep(prev.steps);
              newSteps[stepIndex] = {
                ...newSteps[stepIndex],
                status: ESwapStepStatus.SUCCESS,
              };
              return {
                ...prev,
                steps: newSteps,
              };
            },
          );
        }
      }
    },
    [setInAppNotificationAtom, setSwapSteps],
  );
  const handleApproveFallbackOnCancel = useCallback(
    (stepIndex: number, executionContext?: ISwapExecutionContextGuard) => {
      if (executionContext && !executionContext.isCurrent()) {
        return;
      }
      setSwapSteps(
        (prevSteps: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
          if (executionContext && !executionContext.isCurrent(prevSteps)) {
            return prevSteps;
          }
          const newSteps = [...prevSteps.steps];
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            status: ESwapStepStatus.FAILED,
          };
          return {
            ...prevSteps,
            steps: newSteps,
          };
        },
      );
    },
    [setSwapSteps],
  );

  const handleBuildTxFallbackOnSuccess = useCallback(
    async (
      res?: ISendTxOnSuccessData[],
      orderId?: string,
      executionContext?: ISwapExecutionContextGuard,
    ) => {
      if (res?.[0]) {
        const transactionSignedInfo = res[0].signedTx;
        const txId = transactionSignedInfo.txid;
        const { swapInfo } = transactionSignedInfo;
        const transactionDecodedInfo = res[0].decodedTx;
        const { totalFeeInNative, totalFeeFiatValue } = transactionDecodedInfo;
        if (swapInfo) {
          void onBuildTxSuccess(
            txId,
            swapInfo,
            orderId,
            totalFeeFiatValue,
            totalFeeInNative,
            res[0].isNetworkFeeSponsored,
            executionContext,
          );
        }
      }
    },
    [onBuildTxSuccess],
  );

  const handleBuildTxFallbackOnCancel = useCallback(
    async (
      stepIndex: number,
      executionContext?: ISwapExecutionContextGuard,
    ) => {
      if (executionContext && !executionContext.isCurrent()) {
        return;
      }
      setSwapSteps(
        (prev: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
          if (executionContext && !executionContext.isCurrent(prev)) {
            return prev;
          }
          const newSteps = cloneDeep(prev.steps);
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            status: ESwapStepStatus.FAILED,
          };
          return {
            ...prev,
            steps: newSteps,
          };
        },
      );
    },
    [setSwapSteps],
  );

  const updateStepTitle = useCallback(
    (
      stepIndex: number,
      i: number,
      approveUnsignedTxArr?: IUnsignedTxPro[],
      executionContext?: ISwapExecutionContextGuard,
    ) => {
      setSwapSteps(
        (prev: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
          if (
            !prev.preSwapData.isHWAndExBatchTransfer ||
            (executionContext && !executionContext.isCurrent(prev))
          ) {
            return prev;
          }
          const newSteps = cloneDeep(prev.steps);
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            stepTitle: `${intl.formatMessage({
              id: ETranslations.swap_page_approve_and_swap,
            })} [ ${i + 1} / ${(approveUnsignedTxArr?.length ?? 0) + 1} ]`,
          };
          return {
            ...prev,
            steps: newSteps,
          };
        },
      );
    },
    [intl, setSwapSteps],
  );

  const onApproveTxSuccess = useCallback(() => {
    if (
      accountUtils.isQrAccount({
        accountId: fromAccountId ?? '',
      })
    ) {
      goBackQrCodeModal();
    }
  }, [goBackQrCodeModal, fromAccountId]);

  const findGasInfo = useCallback(
    (stepGasInfos: ISwapGasFeeInfo[], encodedTx: IEncodedTx) => {
      return stepGasInfos?.find(
        (s) =>
          isEqual(s.encodeTx, encodedTx) ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ((s.encodeTx as any)?.rawSignTx &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (encodedTx as any)?.rawSignTx &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (s.encodeTx as any)?.rawSignTx ===
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              (encodedTx as any)?.rawSignTx),
      );
    },
    [],
  );

  const buildGasInfo = useCallback(
    (
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
        megafuelEligible?: IEstimateGasResp['megafuelEligible'];
        payer?: IGasPayer;
        gasAccountEligible?: boolean;
        gasAccountQuote?: IGasAccountQuote;
        gasAccountScenarioReason?: string;
      },
      gasCommon: {
        baseFee?: string;
        feeDecimals: number;
        feeSymbol: string;
        nativeDecimals: number;
        nativeSymbol: string;
        nativeTokenPrice?: number;
      },
      estimateFeeParams?: IEstimateFeeParams,
    ) => {
      const feeSelection = swapNetworkFeeLevelRef.current;
      let gasLet = gasRes.gas?.[1] ?? gasRes.gas?.[0];
      let gasEIP1559Let = gasRes.gasEIP1559?.[1] ?? gasRes.gasEIP1559?.[0];
      let feeUTXOLet = gasRes.feeUTXO?.[1] ?? gasRes.feeUTXO?.[0];
      let feeTronLet = gasRes.feeTron?.[1] ?? gasRes.feeTron?.[0];
      let feeSolLet = gasRes.feeSol?.[1] ?? gasRes.feeSol?.[0];
      let feeCkbLet = gasRes.feeCkb?.[1] ?? gasRes.feeCkb?.[0];
      let feeAlgoLet = gasRes.feeAlgo?.[1] ?? gasRes.feeAlgo?.[0];
      let feeDotLet = gasRes.feeDot?.[1] ?? gasRes.feeDot?.[0];
      let feeBudgetLet = gasRes.feeBudget?.[1] ?? gasRes.feeBudget?.[0];
      if (
        feeSelection?.networkFeeLevel &&
        feeSelection.networkFeeLevel === ESwapNetworkFeeLevel.LOW
      ) {
        gasLet = gasRes.gas?.[0];
        gasEIP1559Let = gasRes.gasEIP1559?.[0];
        feeUTXOLet = gasRes.feeUTXO?.[0];
        feeTronLet = gasRes.feeTron?.[0];
        feeSolLet = gasRes.feeSol?.[0];
        feeCkbLet = gasRes.feeCkb?.[0];
        feeAlgoLet = gasRes.feeAlgo?.[0];
        feeDotLet = gasRes.feeDot?.[0];
        feeBudgetLet = gasRes.feeBudget?.[0];
      }
      if (
        feeSelection?.networkFeeLevel &&
        feeSelection.networkFeeLevel === ESwapNetworkFeeLevel.HIGH
      ) {
        gasLet = gasRes.gas?.[2] ?? gasRes.gas?.[1] ?? gasRes.gas?.[0];
        gasEIP1559Let =
          gasRes.gasEIP1559?.[2] ??
          gasRes.gasEIP1559?.[1] ??
          gasRes.gasEIP1559?.[0];
        feeUTXOLet = gasRes.feeUTXO?.[0];
        feeTronLet = gasRes.feeTron?.[0];
        feeSolLet = gasRes.feeSol?.[0];
        feeCkbLet = gasRes.feeCkb?.[0];
        feeAlgoLet = gasRes.feeAlgo?.[0];
        feeDotLet = gasRes.feeDot?.[0];
        feeBudgetLet = gasRes.feeBudget?.[0];
      }

      const gasInfo = applyCustomPriorityFeeToGasInfo({
        gasInfo: {
          common: gasCommon,
          gas: gasLet,
          gasEIP1559: gasEIP1559Let,
          feeUTXO: feeUTXOLet,
          feeTron: feeTronLet,
          feeSol: feeSolLet,
          feeCkb: feeCkbLet,
          feeAlgo: feeAlgoLet,
          feeDot: feeDotLet,
          feeBudget: feeBudgetLet,
        },
        customPriorityFee: feeSelection?.customPriorityFee,
        estimateFeeParams,
      });
      // Sponsorship (megafuel / Gas Account) never applies to external-wallet
      // accounts, but `serviceGas.estimateFee` does not distinguish them.
      // Strip the sponsored state at the source — restore the real gas price
      // (megafuel zeroes `gasPrice`, keeping it in `originalGasPrice`) and
      // drop the sponsor flags — so the native-balance precheck, the fee
      // display, and the tx handed to the external wallet all use the real fee.
      if (accountUtils.isExternalAccount({ accountId: fromAccountId ?? '' })) {
        return {
          ...gasInfo,
          gas: gasInfo.gas
            ? {
                ...gasInfo.gas,
                gasPrice: gasInfo.gas.originalGasPrice ?? gasInfo.gas.gasPrice,
              }
            : undefined,
          // Keep only the raw megafuel eligibility so the review UI can show
          // the "zero network fee with OneKey wallet" promo hint (OK-61254).
          externalSponsorPromoEligible: !!gasRes.megafuelEligible?.sponsorable,
        };
      }
      // Carry sponsorship result from estimate-fee so it flows into the preview
      // badge and, for Gas Account, the send path broadcast quoteId.
      return {
        ...gasInfo,
        megafuelEligible: gasRes.megafuelEligible,
        payer: gasRes.payer,
        gasAccountEligible: gasRes.gasAccountEligible,
        gasAccountQuote: gasRes.gasAccountQuote,
        gasAccountScenarioReason: gasRes.gasAccountScenarioReason,
      };
    },
    [fromAccountId],
  );

  const sendTxActions = useCallback(
    async (
      isApprove: boolean,
      stepIndex: number,
      networkId: string,
      accountId: string,
      buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams,
      approveUnsignedTxArr?: IUnsignedTxPro[],
      quoteResult?: IFetchQuoteResult,
      needFetchGas?: boolean,
      onSignAndSendProgress?: ISwapSignAndSendProgressCallback,
      parentExecutionContext?: ISwapExecutionContextGuard,
    ) => {
      if (!fromToken || !fromAccountId || !fromUserAddress) {
        throw new OneKeyError('account error');
      }
      parentExecutionContext?.assertCurrent();
      const executionStateAtStart = swapStepsRef.current;
      const expectedQuoteResult = executionStateAtStart.quoteResult;
      const expectedSession = executionStateAtStart.preSwapData.reviewSession;
      const expectedSessionFingerprint = expectedSession
        ? buildSwapReviewSessionFingerprint(expectedSession)
        : undefined;
      const expectedBuildIdentityFingerprint =
        executionStateAtStart.preSwapData.swapBuildResultData
          ?.identityFingerprint;
      const expectedPreparationArtifact =
        executionStateAtStart.preSwapData.preparationArtifact;
      const expectedFeeSnapshot = executionStateAtStart.preSwapData.netWorkFee;
      const expectedGasInfos = expectedFeeSnapshot?.gasInfos;
      const expectedFeeSelectionFingerprint = buildSwapFeeSelectionFingerprint(
        swapNetworkFeeLevelRef.current,
      );
      const isCurrentExecutionContext = (
        current: {
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult;
        } = swapStepsRef.current,
      ): boolean =>
        (parentExecutionContext?.isCurrent(current) ?? true) &&
        isCurrentSwapReviewContext({
          current,
          expectedQuoteResult,
          expectedSession,
          expectedSessionFingerprint,
        }) &&
        current.preSwapData.swapBuildResultData?.identityFingerprint ===
          expectedBuildIdentityFingerprint &&
        current.preSwapData.preparationArtifact ===
          expectedPreparationArtifact &&
        current.preSwapData.netWorkFee === expectedFeeSnapshot &&
        current.preSwapData.netWorkFee?.gasInfos === expectedGasInfos &&
        buildSwapFeeSelectionFingerprint(swapNetworkFeeLevelRef.current) ===
          expectedFeeSelectionFingerprint;
      const executionContext: ISwapExecutionContextGuard = {
        isCurrent: isCurrentExecutionContext,
        assertCurrent: () => {
          if (!isCurrentExecutionContext()) {
            throw new OneKeyError(
              'Swap review changed while sending transaction',
            );
          }
        },
      };
      const stepGasInfos = expectedGasInfos;
      const feeRequestId = buildSwapFeeRequestId(
        executionStateAtStart.preSwapData,
        'execution',
      );
      const swapInfo = buildUnsignedParams?.swapInfo;
      // Backend Gas Account pre-check from the build-tx response. When the
      // sponsorship candidate flag is on we must re-run estimate-fee right
      // before sending to obtain a fresh, non-expired gasAccountQuote.quoteId,
      // so we skip the cached-gas fast path below for sponsored swaps.
      const isGasAccountEnabled =
        !!swapInfo?.swapBuildResData?.result?.gasAccountEnabled;
      let canReuseExecutionFee = false;
      const buildUnsignedParamsCheckNonce = { ...buildUnsignedParams };
      if (approveUnsignedTxArr?.length && approveUnsignedTxArr.length > 0) {
        buildUnsignedParamsCheckNonce.prevNonce =
          approveUnsignedTxArr[approveUnsignedTxArr.length - 1].nonce;
      }
      setSwapSteps(
        (prev: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
          if (!executionContext.isCurrent(prev)) {
            return prev;
          }
          const newSteps = cloneDeep(prev.steps);
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            stepSubTitle: intl.formatMessage({
              id: ETranslations.swap_process_build_and_estimate_tx,
            }),
          };
          return {
            ...prev,
            steps: newSteps,
          };
        },
      );
      executionContext.assertCurrent();
      let lastTxRes: ISwapSendTxResult | undefined;
      const unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          ...buildUnsignedParamsCheckNonce,
          isInternalSwap: true,
        });
      executionContext.assertCurrent();
      canReuseExecutionFee = canReuseSwapReviewExecutionFee({
        preSwapData: executionStateAtStart.preSwapData,
        encodedTx: unsignedTx.encodedTx,
        transfersInfo: unsignedTx.transfersInfo,
        needFetchGas,
        isGasAccountEnabled,
        feeSelectionFingerprint: expectedFeeSelectionFingerprint,
      });
      executionContext.assertCurrent();
      const vaultSettings =
        await backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId,
        });
      executionContext.assertCurrent();
      if (
        approveUnsignedTxArr?.length &&
        approveUnsignedTxArr.length > 0 &&
        vaultSettings.supportBatchEstimateFee?.[networkId]
      ) {
        const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
        if (
          unsignedTxArr.every((tx) =>
            findGasInfo(stepGasInfos ?? [], tx.encodedTx),
          ) &&
          canReuseExecutionFee
        ) {
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            executionContext.assertCurrent();
            const unsignedTxItem = unsignedTxArr[i];
            const gasInfoFinal = findGasInfo(
              stepGasInfos ?? [],
              unsignedTxItem.encodedTx,
            )?.gasInfo;
            if (gasInfoFinal) {
              try {
                updateStepTitle(
                  stepIndex,
                  i,
                  approveUnsignedTxArr,
                  executionContext,
                );
                const res = await updateUnsignedTxAndSendTx({
                  isApprove: i < unsignedTxArr.length - 1,
                  onSignAndSendProgress,
                  stepIndex,
                  networkId,
                  accountId,
                  unsignedTxItem,
                  gasInfo: gasInfoFinal,
                  executionContext,
                });
                if (i === unsignedTxArr.length - 1) {
                  lastTxRes = res;
                } else {
                  void onApproveTxSuccess();
                }
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.SUCCESS,
                    networkId,
                    accountId,
                    undefined,
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
              } catch (e: any) {
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.FAIL,
                    networkId,
                    accountId,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    e?.message ?? 'unknown error',
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
                throw e;
              }
            }
          }
        } else {
          const estimateFeeParamsArr = await Promise.all(
            unsignedTxArr.map((o) =>
              backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                networkId,
                accountId,
                encodedTx: o.encodedTx,
              }),
            ),
          );
          executionContext.assertCurrent();
          try {
            const gasResArr =
              await backgroundApiProxy.serviceGas.batchEstimateFee({
                networkId,
                accountId,
                encodedTxs: estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
                requestId: feeRequestId,
              });
            executionContext.assertCurrent();
            if (!isApprove) {
              void swapEstimateFeeEvent(
                ESwapEventAPIStatus.SUCCESS,
                networkId,
                accountId,
                undefined,
                JSON.stringify(
                  estimateFeeParamsArr.map((o) => o.encodedTx ?? {}) ?? '',
                ),
                swapInfo,
                true,
              );
            }
            for (let i = 0; i < unsignedTxArr.length; i += 1) {
              executionContext.assertCurrent();
              const unsignedTxItem = unsignedTxArr[i];
              const gasRes = gasResArr.txFees[i];
              const gasInfo = buildGasInfo(
                gasRes,
                gasResArr.common,
                estimateFeeParamsArr[i].estimateFeeParams,
              );
              try {
                updateStepTitle(
                  stepIndex,
                  i,
                  approveUnsignedTxArr,
                  executionContext,
                );
                const res = await updateUnsignedTxAndSendTx({
                  isApprove: i < unsignedTxArr.length - 1,
                  onSignAndSendProgress,
                  stepIndex,
                  networkId,
                  accountId,
                  unsignedTxItem,
                  gasInfo,
                  executionContext,
                });
                if (i === unsignedTxArr.length - 1) {
                  lastTxRes = res;
                } else {
                  void onApproveTxSuccess();
                }
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.SUCCESS,
                    networkId,
                    accountId,
                    undefined,
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
              } catch (e: any) {
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.FAIL,
                    networkId,
                    accountId,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    e?.message ?? 'unknown error',
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
                throw e;
              }
            }
          } catch (e: any) {
            if (!isApprove) {
              void swapEstimateFeeEvent(
                ESwapEventAPIStatus.FAIL,
                networkId,
                accountId,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                e?.message ?? 'unknown error',
                JSON.stringify(
                  estimateFeeParamsArr.map((o) => o.encodedTx ?? {}) ?? '',
                ),
                swapInfo,
                true,
              );
            }
            throw e;
          }
        }
      } else if (
        approveUnsignedTxArr?.length &&
        approveUnsignedTxArr.length > 0
      ) {
        const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
        if (
          unsignedTxArr.every((tx) =>
            findGasInfo(stepGasInfos ?? [], tx.encodedTx),
          ) &&
          canReuseExecutionFee
        ) {
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            executionContext.assertCurrent();
            const unsignedTxItem = unsignedTxArr[i];
            const gasInfoFinal = findGasInfo(
              stepGasInfos ?? [],
              unsignedTxItem.encodedTx,
            )?.gasInfo;
            if (gasInfoFinal) {
              try {
                updateStepTitle(
                  stepIndex,
                  i,
                  approveUnsignedTxArr,
                  executionContext,
                );
                const res = await updateUnsignedTxAndSendTx({
                  isApprove: i < unsignedTxArr.length - 1,
                  onSignAndSendProgress,
                  stepIndex,
                  networkId,
                  accountId,
                  unsignedTxItem,
                  gasInfo: gasInfoFinal,
                  executionContext,
                });
                if (i === unsignedTxArr.length - 1) {
                  lastTxRes = res;
                } else {
                  void onApproveTxSuccess();
                }
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.SUCCESS,
                    networkId,
                    accountId,
                    undefined,
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
              } catch (e: any) {
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.FAIL,
                    networkId,
                    accountId,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    e?.message ?? 'unknown error',
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
                throw e;
              }
            }
          }
        } else {
          let lastTxUseGasInfo: IFeeInfoUnit | undefined;
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            executionContext.assertCurrent();
            const unsignedTxItem = unsignedTxArr[i];
            if (i === unsignedTxArr.length - 1) {
              let specialGasLimit: string | undefined;
              const unsignedTxSwapInfo = unsignedTxItem.swapInfo;
              const internalSwapGasLimit =
                unsignedTxSwapInfo?.swapBuildResData.result.gasLimit;
              const internalSwapRoutes =
                unsignedTxSwapInfo?.swapBuildResData.result.routesData;
              const baseGasLimit =
                lastTxUseGasInfo?.gas?.gasLimit ??
                lastTxUseGasInfo?.gasEIP1559?.gasLimit;
              if (!isNil(internalSwapGasLimit)) {
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
              const lastTxGasInfo = {
                common: lastTxUseGasInfo?.common,
                gas: lastTxUseGasInfo?.gas
                  ? {
                      ...lastTxUseGasInfo.gas,
                      gasLimit:
                        specialGasLimit ?? lastTxUseGasInfo.gas.gasLimit,
                    }
                  : undefined,
                gasEIP1559: lastTxUseGasInfo?.gasEIP1559
                  ? {
                      ...lastTxUseGasInfo.gasEIP1559,
                      gasLimit:
                        specialGasLimit ?? lastTxUseGasInfo.gasEIP1559.gasLimit,
                    }
                  : undefined,
              };
              updateStepTitle(
                stepIndex,
                i,
                approveUnsignedTxArr,
                executionContext,
              );
              lastTxRes = await updateUnsignedTxAndSendTx({
                isApprove: false,
                onSignAndSendProgress,
                stepIndex,
                networkId,
                accountId,
                unsignedTxItem,
                gasInfo: lastTxGasInfo,
                executionContext,
              });
            } else {
              const estimateFeeParams =
                await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                  networkId,
                  accountId,
                  encodedTx: unsignedTxItem.encodedTx,
                });
              executionContext.assertCurrent();
              const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
                ...estimateFeeParams,
                accountAddress: fromUserAddress,
                networkId,
                accountId,
                scenario: 'swap',
                requestId: feeRequestId,
              });
              executionContext.assertCurrent();
              const gasParseInfo = buildGasInfo(
                gasRes,
                gasRes.common,
                estimateFeeParams.estimateFeeParams,
              );
              if (i === unsignedTxArr.length - 2) {
                lastTxUseGasInfo = {
                  common: gasRes.common,
                  gas: gasParseInfo.gas,
                  gasEIP1559: gasParseInfo.gasEIP1559,
                };
              }
              updateStepTitle(
                stepIndex,
                i,
                approveUnsignedTxArr,
                executionContext,
              );
              await updateUnsignedTxAndSendTx({
                isApprove: true,
                onSignAndSendProgress,
                stepIndex,
                networkId,
                accountId,
                unsignedTxItem,
                gasInfo: gasParseInfo,
                executionContext,
              });
              void onApproveTxSuccess();
            }
          }
        }
      } else if (
        findGasInfo(stepGasInfos ?? [], unsignedTx.encodedTx) &&
        canReuseExecutionFee &&
        !isGasAccountEnabled
      ) {
        const gasInfoFinal = findGasInfo(
          stepGasInfos ?? [],
          unsignedTx.encodedTx,
        )?.gasInfo;
        if (gasInfoFinal) {
          try {
            lastTxRes = await updateUnsignedTxAndSendTx({
              isApprove,
              onSignAndSendProgress,
              stepIndex,
              networkId,
              accountId,
              unsignedTxItem: unsignedTx,
              gasInfo: gasInfoFinal,
              executionContext,
            });
          } catch (e: any) {
            if (!isApprove) {
              void swapSendTxEvent(
                ESwapEventAPIStatus.FAIL,
                networkId,
                accountId,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                e?.message ?? 'unknown error',
                JSON.stringify(unsignedTx.encodedTx ?? ''),
                swapInfo,
                quoteResult,
              );
            }
            throw e;
          }
        }
      } else {
        const estimateFeeParams =
          await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
            networkId,
            accountId,
            encodedTx: unsignedTx.encodedTx,
          });
        executionContext.assertCurrent();
        try {
          const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
            ...estimateFeeParams,
            accountAddress: fromUserAddress,
            networkId,
            accountId,
            scenario: 'swap',
            requestId: feeRequestId,
            gasAccountEnabled: isGasAccountEnabled,
            transfersInfo: unsignedTx.transfersInfo,
            // Bind the sponsor quote to the nonce that will actually broadcast.
            // prepareSendConfirmUnsignedTx already resolved it on the same
            // unsignedTx, so estimate and broadcast share one nonce (avoids the
            // 40209 NONCE_CHANGED quote drift seen on the confirm page).
            lockedUserNonce:
              typeof unsignedTx.nonce === 'number'
                ? unsignedTx.nonce
                : undefined,
          });
          executionContext.assertCurrent();
          if (!isApprove) {
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.SUCCESS,
              networkId,
              accountId,
              undefined,
              JSON.stringify(unsignedTx.encodedTx ?? ''),
              swapInfo,
            );
          }
          const gasParseInfo = buildGasInfo(
            gasRes,
            gasRes.common,
            estimateFeeParams.estimateFeeParams,
          );
          try {
            lastTxRes = await updateUnsignedTxAndSendTx({
              isApprove,
              onSignAndSendProgress,
              stepIndex,
              networkId,
              accountId,
              unsignedTxItem: unsignedTx,
              gasInfo: gasParseInfo,
              executionContext,
            });
            if (!isApprove) {
              void swapSendTxEvent(
                ESwapEventAPIStatus.SUCCESS,
                networkId,
                accountId,
                undefined,
                JSON.stringify(unsignedTx.encodedTx ?? ''),
                swapInfo,
                quoteResult,
              );
            }
          } catch (e: any) {
            if (!isApprove) {
              void swapSendTxEvent(
                ESwapEventAPIStatus.FAIL,
                networkId,
                accountId,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                e?.message ?? 'unknown error',
                JSON.stringify(unsignedTx.encodedTx ?? ''),
                swapInfo,
                quoteResult,
              );
            }
            throw e;
          }
        } catch (e: any) {
          if (!isApprove) {
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.FAIL,
              networkId,
              accountId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              e?.message ?? 'unknown error',
              JSON.stringify(unsignedTx.encodedTx ?? ''),
              swapInfo,
            );
          }
          throw e;
        }
      }
      return lastTxRes;
    },
    [
      fromToken,
      fromAccountId,
      fromUserAddress,
      setSwapSteps,
      intl,
      findGasInfo,
      updateStepTitle,
      updateUnsignedTxAndSendTx,
      onApproveTxSuccess,
      swapSendTxEvent,
      swapEstimateFeeEvent,
      buildGasInfo,
    ],
  );

  const getApproveUnsignedTx = useCallback(
    async (
      amount: string,
      isMax: boolean,
      data?: IFetchQuoteResult,
      prevNonce?: number,
    ) => {
      if (data?.allowanceResult?.allowanceTarget && fromUserAddress) {
        const approveInfo: IApproveInfo = {
          owner: fromUserAddress,
          spender: data.allowanceResult.allowanceTarget,
          amount,
          isMax: amount === '0' ? false : isMax,
          tokenInfo: {
            ...data.fromTokenInfo,
            isNative: !!data.fromTokenInfo.isNative,
            address: data.fromTokenInfo.contractAddress,
            name: data.fromTokenInfo.name ?? data.fromTokenInfo.symbol,
          },
          swapApproveRes: data,
        };
        if (fromAccountId) {
          const unsignedTx =
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              networkId: data.fromTokenInfo.networkId,
              accountId: fromAccountId ?? '',
              approveInfo,
              prevNonce,
            });
          return { unsignedTx, approveInfo };
        }
      }
      return { unsignedTx: undefined, approveInfo: undefined };
    },
    [fromAccountId, fromUserAddress],
  );
  const approveTxNew = useCallback(
    async (
      stepIndex: number,
      amount: string,
      isMax: boolean,
      data?: IFetchQuoteResult,
      shouldFallback?: boolean,
      shouldWaitApprove?: boolean,
      needFetchGas?: boolean,
      onSignAndSendProgress?: ISwapSignAndSendProgressCallback,
      parentExecutionContext?: ISwapExecutionContextGuard,
    ) => {
      parentExecutionContext?.assertCurrent();
      if (data?.allowanceResult?.allowanceTarget && fromUserAddress) {
        const approveInfo: IApproveInfo = {
          owner: fromUserAddress,
          spender: data.allowanceResult.allowanceTarget,
          amount,
          isMax: amount === '0' ? false : isMax,
          tokenInfo: {
            ...data.fromTokenInfo,
            isNative: !!data.fromTokenInfo.isNative,
            address: data.fromTokenInfo.contractAddress,
            name: data.fromTokenInfo.name ?? data.fromTokenInfo.symbol,
          },
          swapApproveRes: data,
        };
        if (fromAccountId) {
          if (shouldFallback) {
            await navigationToTxConfirm({
              isInternalSwap: true,
              approvesInfo: [approveInfo],
              onSuccess: (successData: ISendTxOnSuccessData[]) =>
                handleApproveFallbackOnSuccess(
                  stepIndex,
                  successData,
                  shouldWaitApprove,
                  parentExecutionContext,
                ),
              onCancel: () =>
                handleApproveFallbackOnCancel(
                  stepIndex,
                  parentExecutionContext,
                ),
            });
            parentExecutionContext?.assertCurrent();
          } else {
            const res = await sendTxActions(
              true,
              stepIndex,
              data.fromTokenInfo.networkId,
              fromAccountId ?? '',
              {
                networkId: data.fromTokenInfo.networkId,
                accountId: fromAccountId ?? '',
                approveInfo,
              },
              undefined,
              data,
              needFetchGas,
              onSignAndSendProgress,
              parentExecutionContext,
            );
            parentExecutionContext?.assertCurrent();
            if (res) {
              void onApproveTxSuccess();
            }
            return res;
          }
        }
      }
    },
    [
      onApproveTxSuccess,
      handleApproveFallbackOnCancel,
      handleApproveFallbackOnSuccess,
      navigationToTxConfirm,
      sendTxActions,
      fromAccountId,
      fromUserAddress,
    ],
  );

  const swapBuildFinish = useCallback(
    async (
      buildSwapRes: { orderId?: string; result?: IFetchQuoteResult },
      quoteResult?: IFetchQuoteResult,
      slippagePercentage = slippageItem.value,
    ) => {
      const swapType = getSwapExecutionTypeFromQuoteResult(
        buildSwapRes?.result,
      );
      if (buildSwapRes?.result?.protocol === EProtocolOfExchange.SWAP) {
        void syncRecentTokenPairs({
          swapFromToken: fromToken as ISwapToken,
          swapToToken: toToken as ISwapToken,
        });
      } else if (buildSwapRes?.result?.protocol === EProtocolOfExchange.LIMIT) {
        appEventBus.emit(
          EAppEventBusNames.SwapLimitOrderBuildSuccess,
          undefined,
        );
        void backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop(
          fromAccountIndexedAccountId,
          !fromAccountIndexedAccountId
            ? (fromAccountId ?? dbAccountId)
            : undefined,
          true,
        );
      }
      defaultLogger.swap.createSwapOrder.swapCreateOrder({
        fromTokenAmount: buildSwapRes.result?.fromAmount ?? '',
        toTokenAmount: buildSwapRes.result?.toAmount ?? '',
        quoteToTokenAmount: quoteResult?.toAmount ?? '',
        fromAddress: fromUserAddress ?? '',
        toAddress: toUserAddress ?? '',
        status: ESwapEventAPIStatus.SUCCESS,
        swapProvider: buildSwapRes.result?.info.provider ?? '',
        swapProviderName: buildSwapRes.result?.info.providerName ?? '',
        swapType,
        slippage: slippagePercentage.toString(),
        sourceChain: buildSwapRes.result?.fromTokenInfo.networkId ?? '',
        receivedChain: buildSwapRes.result?.toTokenInfo.networkId ?? '',
        sourceTokenSymbol: buildSwapRes.result?.fromTokenInfo.symbol ?? '',
        receivedTokenSymbol: buildSwapRes.result?.toTokenInfo.symbol ?? '',
        feeType: buildSwapRes.result?.fee?.percentageFee?.toString() ?? '0',
        router: JSON.stringify(buildSwapRes.result?.routesData ?? ''),
        isFirstTime: isFirstTimeSwap,
        createFrom: getSwapCreateFrom({
          isSwapPro: focusSwapPro,
          isModalPage,
        }),
        orderId: buildSwapRes?.orderId ?? '',
        orderType: getSwapAnalyticsCategoryFromSwapType(swapType),
        ...getStockTradeAnalyticsPayload({
          protocol: buildSwapRes.result?.protocol,
          fromToken: buildSwapRes.result?.fromTokenInfo,
          toToken: buildSwapRes.result?.toTokenInfo,
        }),
      });
      setPersistSettings((prev) => ({
        ...prev,
        isFirstTimeSwap: false,
      }));
    },
    [
      fromToken,
      focusSwapPro,
      isFirstTimeSwap,
      isModalPage,
      setPersistSettings,
      slippageItem.value,
      fromAccountId,
      dbAccountId,
      fromAccountIndexedAccountId,
      fromUserAddress,
      toUserAddress,
      syncRecentTokenPairs,
      toToken,
    ],
  );

  const buildSwapAction = useCallback(
    async (
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
      options?: IBuildSwapActionOptions,
    ) => {
      const {
        skipLoading = false,
        forceRebuild = false,
        slippagePercentage,
        useCustomSlippage = false,
        updateReviewState = true,
        preparationPhase = 'execution',
      } = options ?? {};
      const isReviewPreparation = preparationPhase === 'review';
      const reviewSlippagePercentage =
        swapStepsRef.current.preSwapData.slippage ?? slippageItem.value;
      const effectiveSlippagePercentage =
        slippagePercentage ??
        (data?.protocol === EProtocolOfExchange.STOCK
          ? (data.slippage ?? reviewSlippagePercentage)
          : reviewSlippagePercentage);
      const reviewSession = swapStepsRef.current.preSwapData.reviewSession;
      const preparationCapability =
        swapStepsRef.current.preSwapData.preparationCapability;
      const buildIdentityFingerprint = buildSwapBuildIdentityFingerprint(
        reviewSession,
        effectiveSlippagePercentage,
      );
      const quoteResultAtBuildStart = swapStepsRef.current.quoteResult;
      const expectedFeeSelectionFingerprint = buildSwapFeeSelectionFingerprint(
        swapNetworkFeeLevelRef.current,
      );
      const isCurrentBuildState = (current = swapStepsRef.current): boolean => {
        const currentSession = current.preSwapData.reviewSession;
        if (reviewSession || currentSession) {
          if (
            !reviewSession ||
            !currentSession ||
            currentSession.sessionId !== reviewSession.sessionId ||
            currentSession.revision !== reviewSession.revision ||
            buildSwapReviewSessionFingerprint(currentSession) !==
              buildSwapReviewSessionFingerprint(reviewSession) ||
            buildSwapBuildIdentityFingerprint(
              currentSession,
              effectiveSlippagePercentage,
            ) !== buildIdentityFingerprint
          ) {
            return false;
          }
        }
        return (
          current.quoteResult === quoteResultAtBuildStart &&
          buildSwapFeeSelectionFingerprint(swapNetworkFeeLevelRef.current) ===
            expectedFeeSelectionFingerprint
        );
      };
      const isCurrentBuild = () => isCurrentBuildState();
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        const checkLatestBalanceRes = await checkLatestFromTokenBalance(
          data.fromTokenInfo,
          data.fromAmount,
        );
        if (!checkLatestBalanceRes) {
          throw new OneKeyAppError('checkLatestFromTokenBalance failed');
        }
        const checkRes = await checkOtherFee(data);
        if (!checkRes) {
          throw new OneKeyAppError('checkOtherFee failed');
        }
        const cachedBuildResult =
          swapStepsRef.current.preSwapData.swapBuildResultData;
        const cachedSwapInfo = cachedBuildResult?.swapInfo;
        const cachedBuildResultInfo = cachedSwapInfo?.swapBuildResData?.result;
        const cachedPreparationArtifact =
          swapStepsRef.current.preSwapData.preparationArtifact;
        const cachedFreshnessFingerprint =
          buildSwapReviewPreparationFreshnessFingerprint({
            encodedTx: cachedBuildResult?.encodedTx,
            transferInfo: cachedBuildResult?.transferInfo,
          });
        const canReusePreparedBuild = canReuseSwapReviewPreparedBuild({
          artifact: cachedPreparationArtifact,
          capability: swapStepsRef.current.preSwapData.preparationCapability,
          identity: reviewSession,
          now: Date.now(),
          freshnessFingerprint: cachedFreshnessFingerprint,
          encodedTx: cachedBuildResult?.encodedTx,
          sideEffectsCommitted: cachedBuildResult?.sideEffectsCommitted,
        });
        const canReuseCachedBuild = Boolean(
          !forceRebuild &&
          isCurrentBuild() &&
          buildIdentityFingerprint &&
          cachedBuildResult &&
          canReusePreparedBuild &&
          cachedBuildResult.identityFingerprint === buildIdentityFingerprint &&
          cachedBuildResult.slippagePercentage ===
            effectiveSlippagePercentage &&
          cachedSwapInfo?.accountAddress === fromUserAddress &&
          cachedSwapInfo.receivingAddress === toUserAddress &&
          cachedSwapInfo.sender.accountInfo.accountId === fromAccountId &&
          cachedSwapInfo.sender.accountInfo.networkId ===
            data.fromTokenInfo.networkId &&
          cachedSwapInfo.receiver.accountInfo.networkId ===
            data.toTokenInfo.networkId &&
          cachedSwapInfo.protocol ===
            (data.protocol ?? EProtocolOfExchange.SWAP) &&
          cachedBuildResultInfo?.info.provider === data.info.provider,
        );
        if (canReuseCachedBuild) {
          return cachedBuildResult;
        }
        if (!isCurrentBuild()) {
          throw new OneKeyError('Swap review changed while building');
        }
        if (
          isReviewPreparation &&
          (preparationCapability?.preparationMode !== 'readOnlyPrebuild' ||
            preparationCapability.canPrepareBeforeReview !== true)
        ) {
          throw new OneKeyError(
            'Swap review preparation is not supported for this provider',
          );
        }
        let buildSwapRes: IFetchBuildTxResponse | undefined;
        try {
          if (!skipLoading && updateReviewState) {
            setSwapSteps((prev) => {
              if (
                !isCurrentSwapReviewContext({
                  current: prev,
                  expectedQuoteResult: quoteResultAtBuildStart,
                  expectedSession: reviewSession,
                  expectedSessionFingerprint: reviewSession
                    ? buildSwapReviewSessionFingerprint(reviewSession)
                    : undefined,
                })
              ) {
                return prev;
              }
              return {
                ...prev,
                preSwapData: {
                  ...prev.preSwapData,
                  swapBuildLoading: true,
                },
              };
            });
          }
          const requestFromToken =
            forceRebuild && currentFromToken
              ? currentFromToken
              : data.fromTokenInfo;
          const requestToToken =
            forceRebuild && currentToToken ? currentToToken : data.toTokenInfo;
          buildSwapRes = await backgroundApiProxy.serviceSwap.fetchBuildTx({
            fromToken: requestFromToken,
            toToken: requestToToken,
            toTokenAmount: data.toAmount,
            fromTokenAmount: data.fromAmount,
            slippagePercentage: effectiveSlippagePercentage,
            receivingAddress: toUserAddress ?? '',
            userAddress: fromUserAddress,
            provider: data.info.provider,
            accountId: fromAccountId ?? '',
            quoteResultCtx: useCustomSlippage
              ? buildCustomSlippageQuoteResultCtx(data.quoteResultCtx)
              : data.quoteResultCtx,
            protocol: data.protocol ?? EProtocolOfExchange.SWAP,
            kind: data.kind ?? ESwapQuoteKind.SELL,
            walletType: swapFromAddressInfo.accountInfo?.wallet?.type ?? '',
            tradeSource: getSwapTradeSource({
              protocol: data.protocol,
              isSwapPro: focusSwapPro,
            }),
          });
        } catch (e: any) {
          if (!skipLoading && updateReviewState) {
            setSwapSteps((prev) => {
              if (!isCurrentBuildState(prev)) {
                return prev;
              }
              return {
                ...prev,
                preSwapData: {
                  ...prev.preSwapData,
                  swapBuildLoading: false,
                },
              };
            });
          }
          if (!isReviewPreparation && isCurrentBuildState()) {
            const swapType = getSwapExecutionTypeFromQuoteResult(data);
            defaultLogger.swap.createSwapOrder.swapCreateOrder({
              fromTokenAmount: data?.fromAmount ?? '',
              toTokenAmount: buildSwapRes?.result?.toAmount ?? '',
              quoteToTokenAmount: data?.toAmount ?? '',
              fromAddress: fromUserAddress ?? '',
              toAddress: toUserAddress ?? '',
              status: ESwapEventAPIStatus.FAIL,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              message: e?.message ?? 'unknown error',
              swapProvider: data?.info.provider ?? '',
              swapProviderName: data?.info.providerName ?? '',
              swapType,
              slippage: effectiveSlippagePercentage.toString(),
              sourceChain: data?.fromTokenInfo.networkId ?? '',
              receivedChain: data?.toTokenInfo.networkId ?? '',
              sourceTokenSymbol: data?.fromTokenInfo.symbol ?? '',
              receivedTokenSymbol: data?.toTokenInfo.symbol ?? '',
              feeType: data?.fee?.percentageFee?.toString() ?? '0',
              router: JSON.stringify(data?.routesData ?? ''),
              isFirstTime: isFirstTimeSwap,
              createFrom: getSwapCreateFrom({
                isSwapPro: focusSwapPro,
                isModalPage,
              }),
              orderId: buildSwapRes?.orderId ?? '',
              orderType: getSwapAnalyticsCategoryFromSwapType(swapType),
              ...getStockTradeAnalyticsPayload({
                protocol: data?.protocol,
                fromToken: data?.fromTokenInfo,
                toToken: data?.toTokenInfo,
              }),
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const ne = new Error(e?.message ?? 'unknown error');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ne.name = 'buildSwapApi';
          throw ne;
        }
        if (!isCurrentBuild()) {
          throw new OneKeyError('Swap review changed while building');
        }
        let skipSendTransAction = false;
        if (buildSwapRes) {
          let transferInfo: ITransferInfo | undefined;
          let encodedTx: IEncodedTx | undefined;
          if (buildSwapRes?.swftOrder) {
            encodedTx = undefined;
            // swft order
            transferInfo = {
              from: fromUserAddress ?? '',
              tokenInfo: {
                ...buildSwapRes.result.fromTokenInfo,
                isNative: !!buildSwapRes.result.fromTokenInfo.isNative,
                address: buildSwapRes.result.fromTokenInfo.contractAddress,
                name:
                  buildSwapRes.result.fromTokenInfo.name ??
                  buildSwapRes.result.fromTokenInfo.symbol,
              },
              to: buildSwapRes.swftOrder.platformAddr,
              amount: buildSwapRes.swftOrder.depositCoinAmt,
              memo: buildSwapRes.swftOrder.memo,
            };
          } else if (buildSwapRes?.changellyOrder) {
            encodedTx = undefined;
            // changelly order
            transferInfo = {
              from: fromUserAddress ?? '',
              tokenInfo: {
                ...buildSwapRes.result.fromTokenInfo,
                isNative: !!buildSwapRes.result.fromTokenInfo.isNative,
                address: buildSwapRes.result.fromTokenInfo.contractAddress,
                name:
                  buildSwapRes.result.fromTokenInfo.name ??
                  buildSwapRes.result.fromTokenInfo.symbol,
              },
              to: buildSwapRes.changellyOrder.payinAddress,
              amount: buildSwapRes.changellyOrder.amountExpectedFrom,
              memo: buildSwapRes.changellyOrder.payinExtraId,
            };
          } else if (buildSwapRes?.thorSwapCallData) {
            encodedTx = undefined;
            transferInfo = {
              from: fromUserAddress ?? '',
              tokenInfo: {
                ...buildSwapRes.result.fromTokenInfo,
                isNative: !!buildSwapRes.result.fromTokenInfo.isNative,
                address: buildSwapRes.result.fromTokenInfo.contractAddress,
                name:
                  buildSwapRes.result.fromTokenInfo.name ??
                  buildSwapRes.result.fromTokenInfo.symbol,
              },
              to: buildSwapRes.thorSwapCallData.vault,
              opReturn: buildSwapRes.thorSwapCallData.hasStreamingSwap
                ? buildSwapRes.thorSwapCallData.memoStreamingSwap
                : buildSwapRes.thorSwapCallData.memo,
              amount: new BigNumber(buildSwapRes.thorSwapCallData.amount)
                .shiftedBy(-data.fromTokenInfo.decimals)
                .toFixed(),
            };
          } else if (buildSwapRes?.OKXTxObject) {
            encodedTx =
              await backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx({
                accountId: fromAccountId ?? '',
                networkId: buildSwapRes.result.fromTokenInfo.networkId,
                okxTx: buildSwapRes.OKXTxObject,
                fromTokenInfo: buildSwapRes.result.fromTokenInfo,
                type: getSwapExecutionTypeFromQuoteResult(buildSwapRes.result),
              });
          } else if (buildSwapRes?.LMTronObject) {
            encodedTx =
              await backgroundApiProxy.serviceSwap.buildLMSwapEncodedTx({
                accountId: fromAccountId ?? '',
                networkId: buildSwapRes.result.fromTokenInfo.networkId,
                lmTx: buildSwapRes.LMTronObject,
              });
          } else if (buildSwapRes.tronTxData) {
            transferInfo = undefined;
            encodedTx = buildSwapRes.tronTxData;
          } else if (buildSwapRes.xrpTxData) {
            transferInfo = undefined;
            encodedTx = buildSwapRes.xrpTxData;
          } else if (buildSwapRes?.tx) {
            transferInfo = undefined;
            if (typeof buildSwapRes.tx !== 'string' && buildSwapRes.tx.data) {
              const valueHex = toBigIntHex(
                new BigNumber(buildSwapRes.tx.value ?? 0),
              );
              encodedTx = {
                ...buildSwapRes?.tx,
                value: valueHex,
                from: fromUserAddress ?? '',
              };
            } else {
              encodedTx = buildSwapRes.tx as string;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (buildSwapRes.btcData || buildSwapRes.suiBase64Data) {
            let inputTx: IStakeTx | undefined;
            if (buildSwapRes.btcData) {
              if (
                buildSwapRes.btcData.addressType.includes(
                  swapFromAddressInfo.accountInfo?.deriveInfo
                    ?.addressEncoding ?? '',
                )
              ) {
                inputTx = {
                  psbtHex: buildSwapRes.btcData.hexStr,
                };
              } else {
                Toast.error({
                  title: intl.formatMessage({
                    id: ETranslations.feedback_derivation_path_restriction,
                  }),
                });
              }
            }
            if (buildSwapRes.suiBase64Data) {
              inputTx = buildSwapRes.suiBase64Data;
            }
            if (inputTx) {
              encodedTx =
                await backgroundApiProxy.serviceStaking.buildInternalDappTx({
                  accountId: fromAccountId ?? '',
                  networkId: fromAccountNetworkId ?? '',
                  tx: inputTx,
                  internalDappType: EInternalDappEnum.Swap,
                });
            }
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.cowSwapOrderId ||
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.oneInchFusionOrderHash ||
            buildSwapRes.result.swapShouldSignedData
          ) {
            skipSendTransAction = true;
          }
          // check gasLimit
          const buildGasLimitBN = new BigNumber(
            buildSwapRes.result?.gasLimit ?? 0,
          );
          const quoteGasLimitBN = new BigNumber(data?.gasLimit ?? 0);
          if (
            (buildGasLimitBN.isNaN() || buildGasLimitBN.isZero()) &&
            !quoteGasLimitBN.isNaN() &&
            !quoteGasLimitBN.isZero()
          ) {
            buildSwapRes.result.gasLimit = quoteGasLimitBN.toNumber();
          }
          // check routes
          if (
            !buildSwapRes.result?.routesData?.length &&
            data?.routesData?.length
          ) {
            buildSwapRes.result.routesData = data.routesData;
          }

          const swapInfo: ISwapTxInfo = {
            protocol:
              buildSwapRes.result.protocol ??
              data.protocol ??
              EProtocolOfExchange.SWAP,
            sender: {
              amount: buildSwapRes.result.fromAmount ?? data.fromAmount,
              token: currentFromToken ?? buildSwapRes.result.fromTokenInfo,
              accountInfo: {
                accountId: fromAccountId ?? '',
                networkId: buildSwapRes.result.fromTokenInfo.networkId,
              },
            },
            receiver: {
              amount: buildSwapRes.result.toAmount ?? data.toAmount,
              token: currentToToken ?? buildSwapRes.result.toTokenInfo,
              accountInfo: {
                accountId: toAccountId ?? '',
                networkId: buildSwapRes.result.toTokenInfo.networkId,
              },
            },
            accountAddress: fromUserAddress ?? '',
            receivingAddress: toUserAddress ?? '',
            swapBuildResData: {
              ...buildSwapRes,
              result: {
                ...buildSwapRes.result,
                slippage:
                  slippagePercentage ??
                  buildSwapRes.result.slippage ??
                  effectiveSlippagePercentage,
              },
            },
          };
          const orderId =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.cowSwapOrderId ??
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.oneInchFusionOrderHash ??
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.changeHeroOrderId ??
            buildSwapRes.orderId ??
            buildSwapRes.result.quoteId ??
            '';
          const sideEffectsCommitted =
            hasCommittedSwapBuildSideEffects(buildSwapRes);
          const preparationArtifact =
            isReviewPreparation &&
            reviewSession &&
            preparationCapability &&
            !sideEffectsCommitted &&
            typeof encodedTx !== 'undefined'
              ? createSwapReviewPreparationArtifact({
                  identity: reviewSession,
                  capability: preparationCapability,
                  artifactId: generateUUID(),
                  createdAt: Date.now(),
                  freshnessFingerprint:
                    buildSwapReviewPreparationFreshnessFingerprint({
                      encodedTx,
                      transferInfo,
                    }),
                })
              : undefined;
          if (updateReviewState && isCurrentBuild()) {
            const builtFromAmount =
              buildSwapRes.result.fromAmount ?? data.fromAmount;
            const builtToAmount = buildSwapRes.result.toAmount ?? data.toAmount;
            const builtInstantRate = new BigNumber(builtToAmount)
              .dividedBy(builtFromAmount)
              .toFixed();
            setSwapSteps((prev) => {
              if (
                !isCurrentSwapReviewContext({
                  current: prev,
                  expectedQuoteResult: quoteResultAtBuildStart,
                  expectedSession: reviewSession,
                  expectedSessionFingerprint: reviewSession
                    ? buildSwapReviewSessionFingerprint(reviewSession)
                    : undefined,
                })
              ) {
                return prev;
              }
              const nextState = {
                ...prev,
                preSwapData: {
                  ...prev.preSwapData,
                  swapBuildLoading: false,
                  requiresSlippageRebuildOnConfirm: false,
                  toTokenAmount: builtToAmount,
                  preparationArtifact: isReviewPreparation
                    ? preparationArtifact
                    : undefined,
                  rateDifference:
                    data.protocol === EProtocolOfExchange.LIMIT
                      ? undefined
                      : buildSwapRateDifference({
                          fromTokenPrice: prev.preSwapData.fromToken?.price,
                          toTokenPrice: prev.preSwapData.toToken?.price,
                          fromTokenCurrency:
                            prev.preSwapData.fromToken?.currency,
                          toTokenCurrency: prev.preSwapData.toToken?.currency,
                          defaultTokenCurrency: persistSettings.currencyInfo.id,
                          currencyMap,
                          instantRate: builtInstantRate,
                        }),
                  swapBuildResultData: {
                    swapInfo,
                    orderId,
                    slippagePercentage: effectiveSlippagePercentage,
                    identityFingerprint: buildIdentityFingerprint,
                    sideEffectsCommitted,
                    skipSendTransAction,
                    encodedTx,
                    transferInfo,
                  },
                },
              };
              swapStepsRef.current = nextState;
              return nextState;
            });
          }
          if (!isCurrentBuild()) {
            throw new OneKeyError('Swap review changed while building');
          }
          if (!isReviewPreparation) {
            void swapBuildFinish(
              buildSwapRes,
              data,
              effectiveSlippagePercentage,
            );
          }
          return {
            swapInfo,
            orderId,
            slippagePercentage: effectiveSlippagePercentage,
            identityFingerprint: buildIdentityFingerprint,
            sideEffectsCommitted,
            skipSendTransAction,
            encodedTx,
            transferInfo,
            preparationArtifact,
          };
        }
      }
      if (!skipLoading && updateReviewState) {
        setSwapSteps((prev) => {
          if (!isCurrentBuildState(prev)) {
            return prev;
          }
          return {
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              swapBuildLoading: false,
            },
          };
        });
      }
      return {};
    },
    [
      slippageItem,
      fromUserAddress,
      toUserAddress,
      fromAccountNetworkId,
      fromAccountId,
      setSwapSteps,
      checkLatestFromTokenBalance,
      checkOtherFee,
      swapFromAddressInfo.accountInfo?.wallet?.type,
      swapFromAddressInfo.accountInfo?.deriveInfo?.addressEncoding,
      focusSwapPro,
      isFirstTimeSwap,
      isModalPage,
      toAccountId,
      swapBuildFinish,
      intl,
      persistSettings.currencyInfo.id,
      currencyMap,
    ],
  );

  const buildTxNew = useCallback(
    async (
      stepIndex: number,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
      approveUnsignedTxArr?: IUnsignedTxPro[],
      shouldFallback?: boolean,
      fallbackApproveInfos?: IApproveInfo[],
      needFetchGas?: boolean,
      skipLoading?: boolean,
      onSignAndSendProgress?: ISwapSignAndSendProgressCallback,
      parentExecutionContext?: ISwapExecutionContextGuard,
    ) => {
      parentExecutionContext?.assertCurrent();
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        setSwapSteps(
          (prev: {
            steps: ISwapStep[];
            preSwapData: ISwapPreSwapData;
            quoteResult?: IFetchQuoteResult | undefined;
          }) => {
            if (
              parentExecutionContext &&
              !parentExecutionContext.isCurrent(prev)
            ) {
              return prev;
            }
            const newSteps = cloneDeep(prev.steps);
            newSteps[stepIndex] = {
              ...newSteps[stepIndex],
              stepSubTitle: intl.formatMessage({
                id: ETranslations.swap_process_create_order,
              }),
            };
            return {
              ...prev,
              steps: newSteps,
            };
          },
        );
        const {
          skipSendTransAction,
          encodedTx,
          transferInfo,
          swapInfo,
          orderId,
        } = await buildSwapAction(currentFromToken, currentToToken, data, {
          skipLoading,
          preparationPhase: 'execution',
        });
        parentExecutionContext?.assertCurrent();
        if (swapInfo) {
          if (skipSendTransAction) {
            void handleBuildTxSuccessWithSignedNoSend({
              swapInfo,
              orderId,
              executionContext: parentExecutionContext,
            });
          } else if (shouldFallback) {
            await navigationToTxConfirm({
              isInternalSwap: true,
              transfersInfo: transferInfo ? [transferInfo] : undefined,
              encodedTx,
              approvesInfo:
                fallbackApproveInfos?.length && shouldFallback
                  ? fallbackApproveInfos
                  : undefined,
              swapInfo,
              onSuccess: (successData: ISendTxOnSuccessData[]) =>
                handleBuildTxFallbackOnSuccess(
                  successData,
                  orderId,
                  parentExecutionContext,
                ),
              onCancel: () =>
                handleBuildTxFallbackOnCancel(
                  stepIndex,
                  parentExecutionContext,
                ),
            });
            parentExecutionContext?.assertCurrent();
            setSwapSteps(
              (prev: {
                steps: ISwapStep[];
                preSwapData: ISwapPreSwapData;
                quoteResult?: IFetchQuoteResult | undefined;
              }) => {
                if (
                  parentExecutionContext &&
                  !parentExecutionContext.isCurrent(prev)
                ) {
                  return prev;
                }
                const newSteps = cloneDeep(prev.steps);
                newSteps[stepIndex] = {
                  ...newSteps[stepIndex],
                  stepSubTitle: intl.formatMessage({
                    id: ETranslations.swap_process_build_and_estimate_tx,
                  }),
                };
                return {
                  ...prev,
                  steps: newSteps,
                };
              },
            );
          } else {
            const sendTxRes = await sendTxActions(
              false,
              stepIndex,
              fromAccountNetworkId ?? '',
              fromAccountId ?? '',
              {
                networkId: fromAccountNetworkId ?? '',
                accountId: fromAccountId ?? '',
                transfersInfo: transferInfo ? [transferInfo] : undefined,
                encodedTx,
                swapInfo,
              },
              approveUnsignedTxArr,
              data,
              needFetchGas,
              onSignAndSendProgress,
              parentExecutionContext,
            );
            if (sendTxRes) {
              void onBuildTxSuccess(
                sendTxRes.txid,
                swapInfo,
                orderId,
                sendTxRes.gasFeeFiatValue,
                sendTxRes.gasFeeInNative,
                sendTxRes.isNetworkFeeSponsored,
                parentExecutionContext,
              );
            }
          }
        }
      }
    },
    [
      slippageItem,
      fromUserAddress,
      toUserAddress,
      fromAccountNetworkId,
      fromAccountId,
      setSwapSteps,
      buildSwapAction,
      intl,
      handleBuildTxSuccessWithSignedNoSend,
      navigationToTxConfirm,
      handleBuildTxFallbackOnSuccess,
      handleBuildTxFallbackOnCancel,
      sendTxActions,
      onBuildTxSuccess,
    ],
  );

  const signMessage = useCallback(
    async (
      stepIndex: number,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
      needFetchGas?: boolean,
      parentExecutionContext?: ISwapExecutionContextGuard,
    ) => {
      parentExecutionContext?.assertCurrent();
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        const selectQuoteRes = cloneDeep(data);
        if (selectQuoteRes.swapShouldSignedData && fromAccountId) {
          const checkLatestBalanceRes = await checkLatestFromTokenBalance(
            selectQuoteRes.fromTokenInfo,
            data.fromAmount,
          );
          parentExecutionContext?.assertCurrent();
          if (!checkLatestBalanceRes) {
            throw new OneKeyAppError('checkLatestFromTokenBalance failed');
          }
          const {
            unSignedInfo,
            unSignedMessage,
            unSignedData,
            oneInchFusionOrder,
          } = selectQuoteRes.swapShouldSignedData;
          if (
            (unSignedMessage || unSignedData) &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            selectQuoteRes.quoteResultCtx?.cowSwapUnSignedOrder
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
              selectQuoteRes.quoteResultCtx?.cowSwapUnSignedOrder;
            unSignedOrder.receiver = toUserAddress ?? '';
            let dataMessage = unSignedMessage;
            if (!dataMessage && unSignedData) {
              let validTo = unSignedOrder.validTo;
              const swapLimitExpirationTimeValueBN = new BigNumber(
                swapLimitExpirationTime.value,
              );
              const now = Math.floor(Date.now() / 1000); // 获取当前秒级时间戳
              validTo = new BigNumber(now)
                .plus(swapLimitExpirationTimeValueBN)
                .decimalPlaces(0)
                .toNumber();
              let finalBuyAmount = unSignedOrder.buyAmount;
              let finalSellAmount = unSignedOrder.sellAmount;
              if (
                selectQuoteRes.protocol === EProtocolOfExchange.LIMIT &&
                (swapLimitPriceFromAmount || swapLimitPriceToAmount)
              ) {
                const decimals =
                  selectQuoteRes.kind === ESwapQuoteKind.SELL
                    ? selectQuoteRes.toTokenInfo.decimals
                    : selectQuoteRes.fromTokenInfo.decimals;
                const finalAmountBN = new BigNumber(
                  selectQuoteRes.kind === ESwapQuoteKind.SELL
                    ? (swapLimitPriceToAmount ??
                        selectQuoteRes.toAmount ??
                        unSignedOrder.buyAmount)
                    : (swapLimitPriceFromAmount ??
                        selectQuoteRes.fromAmount ??
                        unSignedOrder.sellAmount),
                ).shiftedBy(decimals);
                if (selectQuoteRes.kind === ESwapQuoteKind.SELL) {
                  finalBuyAmount = finalAmountBN.toFixed();
                } else {
                  finalSellAmount = finalAmountBN.toFixed();
                }
              }
              let partiallyFillable = unSignedOrder.partiallyFillable;
              if (swapLimitPartiallyFillObj.value !== partiallyFillable) {
                partiallyFillable = swapLimitPartiallyFillObj.value;
              }
              unSignedOrder.buyAmount = finalBuyAmount;
              unSignedOrder.sellAmount = finalSellAmount;
              unSignedOrder.validTo = validTo;
              unSignedOrder.partiallyFillable = partiallyFillable;
              const normalizeData = {
                ...unSignedOrder,
                sellTokenBalance:
                  (unSignedOrder.sellTokenBalance as OrderBalance) ??
                  OrderBalance.ERC20,
                buyTokenBalance: normalizeBuyTokenBalance(
                  unSignedOrder.buyTokenBalance as OrderBalance,
                ),
                validTo: timestamp(validTo),
                appData: hashify(unSignedOrder.appData),
              };
              const { ethers: ethersLib } = await getEthers();
              const populated =
                await ethersLib.utils._TypedDataEncoder.resolveNames(
                  unSignedData.domain,
                  unSignedData.types,
                  normalizeData,
                  async (value: string) => value,
                );
              dataMessage = JSON.stringify(
                ethersLib.utils._TypedDataEncoder.getPayload(
                  populated.domain,
                  unSignedData.types,
                  populated.value,
                ),
              );
            }
            if (dataMessage) {
              const signHash = await backgroundApiProxy.serviceSend.signMessage(
                {
                  unsignedMessage: {
                    type:
                      unSignedInfo.signedType ?? EMessageTypesEth.TYPED_DATA_V4,
                    message: dataMessage,
                    payload: [fromUserAddress.toLowerCase(), dataMessage],
                  },
                  networkId: fromAccountNetworkId ?? '',
                  accountId: fromAccountId ?? '',
                },
              );
              parentExecutionContext?.assertCurrent();
              if (signHash) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.cowSwapUnSignedOrder =
                  unSignedOrder;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.signedResult = {
                  signature: signHash,
                  signingScheme: ESigningScheme.EIP712,
                };
                const buildTxRes = await buildTxNew(
                  stepIndex,
                  currentFromToken,
                  currentToToken,
                  selectQuoteRes,
                  undefined,
                  undefined,
                  undefined,
                  needFetchGas,
                  true,
                  undefined,
                  parentExecutionContext,
                );
                return buildTxRes;
              }
              throw new OneKeyError('sign message failed');
            }
          } else if (oneInchFusionOrder) {
            const { makerAddress, typedData } = oneInchFusionOrder;
            const onInchFusionOrderInfo: {
              orderStruct: IOneInchOrderStruct;
              extension: string;
              quoteId: string;
              signature?: string;
              orderHash: string;
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            } = selectQuoteRes.quoteResultCtx?.oneInchFusionOrderCtx;
            if (makerAddress && typedData && onInchFusionOrderInfo) {
              const dataMessage = JSON.stringify(typedData);
              const signHash = await backgroundApiProxy.serviceSend.signMessage(
                {
                  unsignedMessage: {
                    type:
                      unSignedInfo.signedType ?? EMessageTypesEth.TYPED_DATA_V4,
                    message: dataMessage,
                    payload: [fromUserAddress.toLowerCase(), dataMessage],
                  },
                  networkId: fromAccountNetworkId ?? '',
                  accountId: fromAccountId ?? '',
                },
              );
              parentExecutionContext?.assertCurrent();
              if (signHash) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.oneInchFusionOrderCtx = {
                  ...onInchFusionOrderInfo,
                  signature: signHash,
                };
                const buildTxRes = await buildTxNew(
                  stepIndex,
                  currentFromToken,
                  currentToToken,
                  selectQuoteRes,
                  undefined,
                  undefined,
                  undefined,
                  needFetchGas,
                  true,
                  undefined,
                  parentExecutionContext,
                );
                return buildTxRes;
              }
              throw new OneKeyError('sign message failed');
            }
          }
        }
      }
    },
    [
      buildTxNew,
      checkLatestFromTokenBalance,
      slippageItem,
      fromAccountId,
      fromUserAddress,
      fromAccountNetworkId,
      swapLimitExpirationTime.value,
      swapLimitPartiallyFillObj.value,
      swapLimitPriceFromAmount,
      swapLimitPriceToAmount,
      toUserAddress,
    ],
  );

  const wrappedTx = useCallback(
    async (
      stepIndex: number,
      data?: IFetchQuoteResult,
      fromTokenInfo?: ISwapToken,
      toTokenInfo?: ISwapToken,
      needFetchGas?: boolean,
      onSignAndSendProgress?: ISwapSignAndSendProgressCallback,
      parentExecutionContext?: ISwapExecutionContextGuard,
    ) => {
      parentExecutionContext?.assertCurrent();
      if (
        fromTokenInfo &&
        toTokenInfo &&
        fromUserAddress &&
        toUserAddress &&
        data?.fromAmount &&
        fromAccountId
      ) {
        setSwapBuildTxFetching(true);
        const wrappedType = fromTokenInfo.isNative
          ? EWrappedType.DEPOSIT
          : EWrappedType.WITHDRAW;
        const wrappedInfo: IWrappedInfo = {
          from: fromUserAddress ?? '',
          type: wrappedType,
          contract:
            wrappedType === EWrappedType.WITHDRAW
              ? fromTokenInfo.contractAddress
              : toTokenInfo.contractAddress,
          amount: data.fromAmount ?? '',
        };
        const swapInfo = {
          protocol: data?.protocol ?? EProtocolOfExchange.SWAP,
          sender: {
            amount: data.fromAmount ?? '',
            token: fromTokenInfo,
            accountInfo: {
              accountId: fromAccountId ?? '',
              networkId: fromTokenInfo.networkId,
            },
          },
          receiver: {
            amount: data.toAmount ?? '',
            token: toTokenInfo,
            accountInfo: {
              accountId: toAccountId ?? '',
              networkId: toTokenInfo.networkId,
            },
          },
          accountAddress: fromUserAddress ?? '',
          receivingAddress: toUserAddress ?? '',
          swapBuildResData: {
            result: { ...data },
            orderId: data.quoteId ?? '',
          },
        };

        const sendTxRes = await sendTxActions(
          false,
          stepIndex,
          fromTokenInfo.networkId,
          fromAccountId ?? '',
          {
            networkId: fromTokenInfo.networkId,
            accountId: fromAccountId ?? '',
            wrappedInfo,
            swapInfo,
          },
          undefined,
          data,
          needFetchGas,
          onSignAndSendProgress,
          parentExecutionContext,
        );
        parentExecutionContext?.assertCurrent();

        if (sendTxRes) {
          void syncRecentTokenPairs({
            swapFromToken: fromTokenInfo,
            swapToToken: toTokenInfo,
          });
          void onBuildTxSuccess(
            sendTxRes.txid,
            swapInfo,
            undefined,
            sendTxRes.gasFeeFiatValue,
            sendTxRes.gasFeeInNative,
            sendTxRes.isNetworkFeeSponsored,
            parentExecutionContext,
          );
          return sendTxRes;
        }
      }
    },
    [
      fromUserAddress,
      toUserAddress,
      fromAccountId,
      setSwapBuildTxFetching,
      toAccountId,
      sendTxActions,
      syncRecentTokenPairs,
      onBuildTxSuccess,
    ],
  );

  const getApproveUnSignedTxArr = useCallback(
    async (data?: IFetchQuoteResult) => {
      let unsignedTxArr: IUnsignedTxPro[] = [];
      let fallbackApproveInfos: IApproveInfo[] = [];
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        let prevNonce: number | undefined;
        if (data.allowanceResult) {
          if (data.allowanceResult.shouldResetApprove) {
            const {
              unsignedTx: resetApproveUnsignedTx,
              approveInfo: resetApproveApproveInfo,
            } = await getApproveUnsignedTx(
              '0',
              !!swapActionState.approveUnLimit,
              data,
            );
            if (resetApproveUnsignedTx) {
              unsignedTxArr = [...unsignedTxArr, resetApproveUnsignedTx];
              prevNonce = resetApproveUnsignedTx.nonce;
            }
            if (resetApproveApproveInfo) {
              fallbackApproveInfos = [
                ...fallbackApproveInfos,
                resetApproveApproveInfo,
              ];
            }
          }
          const {
            unsignedTx: approveUnsignedTx,
            approveInfo: approveApproveInfo,
          } = await getApproveUnsignedTx(
            data.fromAmount,
            !!swapActionState.approveUnLimit,
            data,
            prevNonce,
          );
          if (approveUnsignedTx) {
            unsignedTxArr = [...unsignedTxArr, approveUnsignedTx];
          }
          if (approveApproveInfo) {
            fallbackApproveInfos = [
              ...fallbackApproveInfos,
              approveApproveInfo,
            ];
          }
        }
      }
      return {
        unsignedTxArr,
        fallbackApproveInfos,
      };
    },
    [
      slippageItem,
      fromUserAddress,
      fromAccountNetworkId,
      fromAccountId,
      toUserAddress,
      getApproveUnsignedTx,
      swapActionState.approveUnLimit,
    ],
  );
  const batchApproveSwap = useCallback(
    async (
      stepIndex: number,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
      shouldFallback?: boolean,
      needFetchGas?: boolean,
      onSignAndSendProgress?: ISwapSignAndSendProgressCallback,
      parentExecutionContext?: ISwapExecutionContextGuard,
    ) => {
      parentExecutionContext?.assertCurrent();
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        const { unsignedTxArr, fallbackApproveInfos } =
          await getApproveUnSignedTxArr(data);
        parentExecutionContext?.assertCurrent();
        await buildTxNew(
          stepIndex,
          currentFromToken,
          currentToToken,
          data,
          unsignedTxArr,
          shouldFallback,
          fallbackApproveInfos,
          needFetchGas,
          undefined,
          onSignAndSendProgress,
          parentExecutionContext,
        );
      }
    },
    [
      slippageItem,
      fromUserAddress,
      fromAccountNetworkId,
      fromAccountId,
      toUserAddress,
      getApproveUnSignedTxArr,
      buildTxNew,
    ],
  );

  const estimateNetworkFee = useCallback(
    async (
      networkId: string,
      accountId: string,
      buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams,
      approveUnsignedTxArr?: IUnsignedTxPro[],
      options?: IEstimateNetworkFeeOptions,
    ): Promise<IEstimateNetworkFeeResult> => {
      const { updateReviewState = true } = options ?? {};
      if (!fromToken || !fromAccountId || !fromUserAddress) {
        throw new OneKeyError('account error');
      }
      const reviewStateAtStart = swapStepsRef.current;
      const expectedQuoteResult = reviewStateAtStart.quoteResult;
      const expectedSession = reviewStateAtStart.preSwapData.reviewSession;
      const expectedSessionFingerprint = expectedSession
        ? buildSwapReviewSessionFingerprint(expectedSession)
        : undefined;
      const expectedBuildIdentityFingerprint =
        reviewStateAtStart.preSwapData.swapBuildResultData?.identityFingerprint;
      const expectedFeeSelectionFingerprint = buildSwapFeeSelectionFingerprint(
        swapNetworkFeeLevelRef.current,
      );
      const expectedFeeFreshnessFingerprint = buildSwapFeeFreshnessFingerprint({
        encodedTx: buildUnsignedParams.encodedTx,
        feeSelectionFingerprint: expectedFeeSelectionFingerprint,
        transferInfo: buildUnsignedParams.transfersInfo,
      });
      const isCurrentReview = (current = swapStepsRef.current): boolean =>
        isCurrentSwapReviewContext({
          current,
          expectedQuoteResult,
          expectedSession,
          expectedSessionFingerprint,
        }) &&
        buildSwapFeeSelectionFingerprint(swapNetworkFeeLevelRef.current) ===
          expectedFeeSelectionFingerprint;
      const assertCurrentReview = () => {
        if (!isCurrentReview()) {
          throw new OneKeyError(
            'Swap review changed while estimating network fee',
          );
        }
      };
      const gasAccountReviewSession = gasAccountReviewSessionRef.current;
      const feeRequestId = buildSwapFeeRequestId(
        reviewStateAtStart.preSwapData,
        'preview',
      );
      const swapInfo = buildUnsignedParams?.swapInfo;
      // Gas Account sponsorship pre-check from the build-tx response; forwarded
      // to estimate-fee so the preview can decide whether to show the sponsored
      // badge based on the real `gasAccountEligible` response.
      const isGasAccountEnabled =
        !!swapInfo?.swapBuildResData?.result?.gasAccountEnabled;
      const buildUnsignedParamsCheckNonce = { ...buildUnsignedParams };
      if (approveUnsignedTxArr?.length && approveUnsignedTxArr.length > 0) {
        buildUnsignedParamsCheckNonce.prevNonce =
          approveUnsignedTxArr[approveUnsignedTxArr.length - 1].nonce;
      }
      let gasFeeInfos: ISwapGasFeeInfo[] = [];
      const unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          ...buildUnsignedParamsCheckNonce,
          isInternalSwap: true,
        });
      assertCurrentReview();

      if (updateReviewState) {
        setSwapSteps((prev) => {
          if (!isCurrentReview(prev)) {
            return prev;
          }
          return {
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              estimateNetworkFeeLoading: true,
            },
          };
        });
      }
      try {
        const vaultSettings =
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          });
        assertCurrentReview();
        if (
          approveUnsignedTxArr?.length &&
          approveUnsignedTxArr.length > 0 &&
          vaultSettings.supportBatchEstimateFee?.[networkId]
        ) {
          const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
          const estimateFeeParamsArr = await Promise.all(
            unsignedTxArr.map((o) =>
              backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                networkId,
                accountId,
                encodedTx: o.encodedTx,
              }),
            ),
          );
          assertCurrentReview();
          try {
            const gasResArr =
              await backgroundApiProxy.serviceGas.batchEstimateFee({
                networkId,
                accountId,
                encodedTxs: estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
                requestId: feeRequestId,
              });
            assertCurrentReview();
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.SUCCESS,
              networkId,
              accountId,
              undefined,
              JSON.stringify(
                estimateFeeParamsArr.map((o) => o.encodedTx ?? {}) ?? '',
              ),
              swapInfo,
              true,
            );
            for (let i = 0; i < unsignedTxArr.length; i += 1) {
              const unsignedTxItem = unsignedTxArr[i];
              const gasRes = gasResArr.txFees[i];
              const gasInfo = buildGasInfo(
                gasRes,
                gasResArr.common,
                estimateFeeParamsArr[i].estimateFeeParams,
              );
              gasFeeInfos.push({
                encodeTx: unsignedTxItem.encodedTx ?? {},
                gasInfo,
                txSize: unsignedTxItem.txSize,
              });
            }
          } catch (e: any) {
            if (!isCurrentReview()) {
              throw e;
            }
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.FAIL,
              networkId,
              accountId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              e?.message ?? 'unknown error',
              JSON.stringify(
                estimateFeeParamsArr.map((o) => o.encodedTx ?? {}) ?? '',
              ),
              swapInfo,
              true,
            );
            if (
              canFallbackToSeparateTxConfirm({
                buildUnsignedParams,
                approveUnsignedTxArr,
              })
            ) {
              if (updateReviewState) {
                setSwapSteps((prev) => {
                  if (!isCurrentReview(prev)) {
                    return prev;
                  }
                  return {
                    ...prev,
                    preSwapData: {
                      ...prev.preSwapData,
                      estimateNetworkFeeLoading: false,
                      netWorkFee: undefined,
                    },
                  };
                });
              }
              return {
                fallbackToSeparateTxConfirm: true,
              };
            }
            throw e;
          }
        } else if (
          approveUnsignedTxArr?.length &&
          approveUnsignedTxArr.length > 0
        ) {
          const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
          let lastTxUseGasInfo: IFeeInfoUnit | undefined;
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            if (i === unsignedTxArr.length - 1) {
              let specialGasLimit: string | undefined;
              const unsignedTxSwapInfo = unsignedTxItem.swapInfo;
              const internalSwapGasLimit =
                unsignedTxSwapInfo?.swapBuildResData.result.gasLimit;
              const internalSwapRoutes =
                unsignedTxSwapInfo?.swapBuildResData.result.routesData;
              const baseGasLimit =
                lastTxUseGasInfo?.gas?.gasLimit ??
                lastTxUseGasInfo?.gasEIP1559?.gasLimit;
              if (!isNil(internalSwapGasLimit)) {
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
              const lastTxGasInfo = {
                common: lastTxUseGasInfo?.common,
                gas: lastTxUseGasInfo?.gas
                  ? {
                      ...lastTxUseGasInfo.gas,
                      gasLimit:
                        specialGasLimit ?? lastTxUseGasInfo.gas.gasLimit,
                    }
                  : undefined,
                gasEIP1559: lastTxUseGasInfo?.gasEIP1559
                  ? {
                      ...lastTxUseGasInfo.gasEIP1559,
                      gasLimit:
                        specialGasLimit ?? lastTxUseGasInfo.gasEIP1559.gasLimit,
                    }
                  : undefined,
              };
              gasFeeInfos.push({
                encodeTx: unsignedTxItem.encodedTx,
                gasInfo: lastTxGasInfo,
                txSize: unsignedTxItem.txSize,
              });
            } else {
              assertCurrentReview();
              const estimateFeeParams =
                await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                  networkId,
                  accountId,
                  encodedTx: unsignedTxItem.encodedTx,
                });
              assertCurrentReview();
              const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
                ...estimateFeeParams,
                accountAddress: fromUserAddress ?? '',
                networkId,
                accountId,
                scenario: 'swap',
                requestId: feeRequestId,
              });
              assertCurrentReview();
              const gasParseInfo = buildGasInfo(
                gasRes,
                gasRes.common,
                estimateFeeParams.estimateFeeParams,
              );
              if (i === unsignedTxArr.length - 2) {
                lastTxUseGasInfo = {
                  common: gasRes.common,
                  gas: gasParseInfo.gas,
                  gasEIP1559: gasParseInfo.gasEIP1559,
                };
              }
              gasFeeInfos.push({
                encodeTx: unsignedTxItem.encodedTx,
                gasInfo: gasParseInfo,
                txSize: unsignedTxItem.txSize,
              });
            }
          }
        } else {
          const estimateFeeParams =
            await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
              networkId,
              accountId,
              encodedTx: unsignedTx.encodedTx,
            });
          assertCurrentReview();
          try {
            const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
              ...estimateFeeParams,
              accountAddress: fromUserAddress ?? '',
              networkId,
              accountId,
              scenario: 'swap',
              requestId: feeRequestId,
              gasAccountEnabled: isGasAccountEnabled,
              transfersInfo: unsignedTx.transfersInfo,
              lockedUserNonce:
                typeof unsignedTx.nonce === 'number'
                  ? unsignedTx.nonce
                  : undefined,
            });
            assertCurrentReview();
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.SUCCESS,
              networkId,
              accountId,
              undefined,
              JSON.stringify(unsignedTx.encodedTx ?? ''),
              swapInfo,
            );
            const gasParseInfo = buildGasInfo(
              gasRes,
              gasRes.common,
              estimateFeeParams.estimateFeeParams,
            );
            gasFeeInfos = [
              ...gasFeeInfos,
              {
                encodeTx: unsignedTx.encodedTx,
                gasInfo: gasParseInfo,
                txSize: unsignedTx.txSize,
              },
            ];
          } catch (e: any) {
            if (!isCurrentReview()) {
              throw e;
            }
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.FAIL,
              networkId,
              accountId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              e?.message ?? 'unknown error',
              JSON.stringify(unsignedTx.encodedTx ?? ''),
              swapInfo,
            );

            throw e;
          }
        }
        const checkLatestNativeBalanceRes = await checkLatestNativeTokenBalance(
          {
            gasInfos: gasFeeInfos,
            networkId,
            token: swapInfo?.sender.token,
            amount: swapInfo?.sender.amount,
            otherFeeInfos:
              swapInfo?.swapBuildResData.result?.fee?.otherFeeInfos,
          },
        );
        assertCurrentReview();
        const swapGasFeeInfo = findGasInfo(gasFeeInfos, unsignedTx.encodedTx);
        const gasAccountAnalyticsContext = swapGasFeeInfo
          ? buildDirectSwapGasAccountAnalyticsContext({
              entryPoint: 'swapDirect',
              networkId,
              unsignedTx,
              gasInfo: swapGasFeeInfo.gasInfo,
              txSize: swapGasFeeInfo.txSize,
              nativeBalance: checkLatestNativeBalanceRes.nativeBalance,
              useGasAccountByDefault: persistSettings.useGasAccountByDefault,
              fiatCurrency: persistSettings.currencyInfo.id,
            })
          : undefined;
        if (
          isCurrentReview() &&
          gasAccountAnalyticsContext &&
          gasAccountReviewSession &&
          gasAccountReviewSessionRef.current === gasAccountReviewSession
        ) {
          gasAccountReviewSession.nativeBalance =
            checkLatestNativeBalanceRes.nativeBalance;
          gasAccountReviewSession.analyticsContext = gasAccountAnalyticsContext;
          if (!gasAccountReviewSession.decisionLogged) {
            gasAccountReviewSession.decisionLogged = true;
            logDirectSwapGasAccountDecision(gasAccountAnalyticsContext);
          }
        }
        if (!checkLatestNativeBalanceRes.isSufficient) {
          throw new OneKeyAppError('checkLatestNativeTokenBalance failed');
        }
        const gasFeeFiatValues = await Promise.all(
          gasFeeInfos.map(async (item) => {
            const { gasInfo } = item;
            const { common } = gasInfo;
            const feeResult = calculateFeeForSend({
              feeInfo: gasInfo as IFeeInfoUnit,
              nativeTokenPrice: common?.nativeTokenPrice ?? 0,
              txSize: item.txSize,
            });
            return feeResult.totalFiatMinForDisplay;
          }),
        );
        assertCurrentReview();
        const gasFeeFiatValueAll = gasFeeFiatValues.reduce((acc, curr) => {
          return acc.plus(new BigNumber(curr));
        }, new BigNumber(0));
        const netWorkFee: ISwapPreSwapData['netWorkFee'] = {
          gasInfos: [...gasFeeInfos],
          gasFeeFiatValue: !gasFeeFiatValueAll.isZero()
            ? gasFeeFiatValueAll.toFixed()
            : undefined,
          sessionId: expectedSession?.sessionId,
          revision: expectedSession?.revision,
          identityFingerprint: expectedBuildIdentityFingerprint,
          freshnessFingerprint: expectedFeeFreshnessFingerprint,
          feeSelectionFingerprint: expectedFeeSelectionFingerprint,
        };
        assertCurrentReview();
        if (updateReviewState) {
          setSwapSteps((prev) => {
            if (!isCurrentReview(prev)) {
              return prev;
            }
            return {
              ...prev,
              preSwapData: {
                ...prev.preSwapData,
                netWorkFee,
                estimateNetworkFeeLoading: false,
              },
            };
          });
        }
        return { netWorkFee };
      } catch (_e: any) {
        if (updateReviewState) {
          setSwapSteps((prev) => {
            if (!isCurrentReview(prev)) {
              return prev;
            }
            return {
              ...prev,
              preSwapData: {
                ...prev.preSwapData,
                estimateNetworkFeeLoading: false,
              },
            };
          });
        }
        throw _e;
      }
    },
    [
      buildGasInfo,
      fromToken,
      setSwapSteps,
      swapEstimateFeeEvent,
      fromAccountId,
      fromUserAddress,
      checkLatestNativeTokenBalance,
      findGasInfo,
      persistSettings.currencyInfo.id,
      persistSettings.useGasAccountByDefault,
    ],
  );

  const rebuildSwapWithSlippage = useCallback(
    async ({ slippagePercentage }: { slippagePercentage: number }) => {
      const frozenReviewState = swapStepsRef.current;
      const frozenQuoteResult = frozenReviewState.quoteResult;
      const frozenReviewSession = frozenReviewState.preSwapData.reviewSession;
      if (frozenReviewSession) {
        void backgroundApiProxy.serviceGas.abortEstimateFee({
          requestIdPrefix: `swap:${frozenReviewSession.sessionId}:`,
        });
      }
      const rebuildReviewSession = frozenReviewSession
        ? {
            ...frozenReviewSession,
            revision: frozenReviewSession.revision + 1,
            slippage: slippagePercentage,
          }
        : undefined;
      const supportRebuildTx =
        frozenReviewState.preSwapData.swapBuildResultData?.swapInfo
          ?.swapBuildResData.supportRebuildTx;

      if (!frozenQuoteResult || !supportRebuildTx) {
        throw new OneKeyError('Current swap quote does not support rebuilding');
      }

      const expectedFeeSelectionFingerprint = buildSwapFeeSelectionFingerprint(
        swapNetworkFeeLevelRef.current,
      );
      const requestId = rebuildSwapRequestIdRef.current + 1;
      rebuildSwapRequestIdRef.current = requestId;
      setSwapSteps((prev) => {
        if (
          buildSwapFeeSelectionFingerprint(swapNetworkFeeLevelRef.current) !==
            expectedFeeSelectionFingerprint ||
          prev.quoteResult !== frozenQuoteResult ||
          (frozenReviewSession &&
            (!prev.preSwapData.reviewSession ||
              prev.preSwapData.reviewSession.sessionId !==
                frozenReviewSession.sessionId ||
              prev.preSwapData.reviewSession.revision !==
                frozenReviewSession.revision))
        ) {
          return prev;
        }
        const nextState = {
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            reviewSession: rebuildReviewSession,
            preparationArtifact: undefined,
            swapBuildResultData: undefined,
            netWorkFee: undefined,
            supportNetworkFeeLevel: false,
            swapBuildLoading: true,
            estimateNetworkFeeLoading: false,
            stepBeforeActionsError: undefined,
          },
        };
        swapStepsRef.current = nextState;
        return nextState;
      });
      if (
        rebuildReviewSession &&
        (swapStepsRef.current.preSwapData.reviewSession?.sessionId !==
          rebuildReviewSession.sessionId ||
          swapStepsRef.current.preSwapData.reviewSession.revision !==
            rebuildReviewSession.revision)
      ) {
        throw new OneKeyError('Swap review changed while rebuilding');
      }

      let activeReviewSession = rebuildReviewSession;
      const isCurrentRebuildContext = (current = swapStepsRef.current) =>
        requestId === rebuildSwapRequestIdRef.current &&
        buildSwapFeeSelectionFingerprint(swapNetworkFeeLevelRef.current) ===
          expectedFeeSelectionFingerprint &&
        isCurrentSwapReviewContext({
          current,
          expectedQuoteResult: frozenQuoteResult,
          expectedSession: activeReviewSession,
          expectedSessionFingerprint: activeReviewSession
            ? buildSwapReviewSessionFingerprint(activeReviewSession)
            : undefined,
        });

      try {
        let rebuiltSwapBuildResultData = await buildSwapAction(
          frozenReviewState.preSwapData.fromToken,
          frozenReviewState.preSwapData.toToken,
          frozenQuoteResult,
          {
            forceRebuild: true,
            slippagePercentage,
            useCustomSlippage: true,
            updateReviewState: false,
            preparationPhase: 'review',
          },
        );
        if (!isCurrentRebuildContext()) {
          throw new OneKeyError('Swap review changed while rebuilding');
        }
        const {
          preparationArtifact: previousArtifact,
          ...rebuiltSwapBuildResultDataWithoutArtifact
        } = rebuiltSwapBuildResultData;
        rebuiltSwapBuildResultData = rebuiltSwapBuildResultDataWithoutArtifact;
        const { swapInfo, transferInfo, encodedTx } =
          rebuiltSwapBuildResultData;
        if (!swapInfo) {
          throw new OneKeyError('Failed to rebuild swap transaction');
        }

        const rebuiltQuoteResult = buildRebuiltSwapReviewQuoteResult({
          quoteResult: frozenQuoteResult,
          buildResult: swapInfo.swapBuildResData.result,
          slippagePercentage,
        });
        const finalizedReviewSession = rebuildReviewSession
          ? {
              ...rebuildReviewSession,
              fromAmount:
                rebuiltQuoteResult.fromAmount ??
                rebuildReviewSession.fromAmount,
              toAmount:
                rebuiltQuoteResult.toAmount ?? rebuildReviewSession.toAmount,
              provider:
                rebuiltQuoteResult.info.provider ??
                rebuildReviewSession.provider,
              quoteId:
                rebuiltQuoteResult.quoteId ?? rebuildReviewSession.quoteId,
              eventId:
                rebuiltQuoteResult.eventId ?? rebuildReviewSession.eventId,
              protocol:
                rebuiltQuoteResult.protocol ?? rebuildReviewSession.protocol,
              quoteContextFingerprint: stableStringify(
                rebuiltQuoteResult.quoteResultCtx ?? null,
              ),
              routeFingerprint: stableStringify(
                rebuiltQuoteResult.routesData ?? [],
              ),
            }
          : undefined;
        if (finalizedReviewSession) {
          const preparationCapability = resolveSwapReviewPreparationCapability({
            declaration: rebuiltQuoteResult.quoteExtraData?.reviewPreparation,
            implementation: finalizedReviewSession.implementation,
            provider: rebuiltQuoteResult.info.provider,
          });
          const finalizedArtifact =
            previousArtifact && preparationCapability
              ? createSwapReviewPreparationArtifact({
                  identity: finalizedReviewSession,
                  capability: preparationCapability,
                  artifactId: generateUUID(),
                  createdAt: Date.now(),
                  freshnessFingerprint:
                    buildSwapReviewPreparationFreshnessFingerprint({
                      encodedTx,
                      transferInfo,
                    }),
                })
              : undefined;
          activeReviewSession = finalizedReviewSession;
          rebuiltSwapBuildResultData = {
            ...rebuiltSwapBuildResultData,
            identityFingerprint: buildSwapReviewSessionFingerprint(
              finalizedReviewSession,
            ),
          };
          setSwapSteps((prev) => {
            if (!isCurrentRebuildContext(prev)) {
              return prev;
            }
            const nextState = {
              ...prev,
              preSwapData: {
                ...prev.preSwapData,
                reviewSession: finalizedReviewSession,
                preparationCapability,
                preparationArtifact: finalizedArtifact,
                swapBuildResultData: rebuiltSwapBuildResultData,
                requiresSlippageRebuildOnConfirm: false,
              },
            };
            swapStepsRef.current = nextState;
            return nextState;
          });
        }
        const { unsignedTxArr } =
          await getApproveUnSignedTxArr(rebuiltQuoteResult);
        const estimateNetworkFeeResult = await estimateNetworkFee(
          fromAccountNetworkId ?? '',
          fromAccountId ?? '',
          {
            networkId: fromAccountNetworkId ?? '',
            accountId: fromAccountId ?? '',
            transfersInfo: transferInfo ? [transferInfo] : undefined,
            encodedTx,
            swapInfo,
          },
          unsignedTxArr,
          { updateReviewState: false },
        );

        if (
          requestId !== rebuildSwapRequestIdRef.current ||
          swapStepsRef.current.quoteResult !== frozenQuoteResult
        ) {
          throw new OneKeyError('Swap review changed while rebuilding');
        }

        const shouldFallback = Boolean(
          estimateNetworkFeeResult.fallbackToSeparateTxConfirm,
        );
        const needFetchGasAfterRebuild =
          resolveSwapReviewNeedFetchGasAfterRebuild({
            fallbackToSeparateTxConfirm: shouldFallback,
            previousNeedFetchGas: frozenReviewState.preSwapData.needFetchGas,
          });
        const shouldResetSteps =
          shouldFallback || frozenReviewState.preSwapData.shouldFallback;
        const separateSteps = shouldResetSteps
          ? buildSeparateApproveAndSwapSteps(rebuiltQuoteResult)
          : undefined;
        setSwapSteps((prev) => {
          if (!isCurrentRebuildContext(prev)) {
            return prev;
          }
          const nextState = {
            ...prev,
            steps: separateSteps?.length ? separateSteps : prev.steps,
            quoteResult: rebuiltQuoteResult,
            preSwapData: {
              ...prev.preSwapData,
              fromTokenAmount: rebuiltQuoteResult.fromAmount,
              toTokenAmount: rebuiltQuoteResult.toAmount,
              rateDifference:
                rebuiltQuoteResult.protocol === EProtocolOfExchange.LIMIT
                  ? undefined
                  : buildSwapRateDifference({
                      fromTokenPrice: prev.preSwapData.fromToken?.price,
                      toTokenPrice: prev.preSwapData.toToken?.price,
                      fromTokenCurrency: prev.preSwapData.fromToken?.currency,
                      toTokenCurrency: prev.preSwapData.toToken?.currency,
                      defaultTokenCurrency: persistSettings.currencyInfo.id,
                      currencyMap,
                      instantRate: new BigNumber(
                        rebuiltQuoteResult.toAmount ?? '',
                      )
                        .dividedBy(rebuiltQuoteResult.fromAmount ?? '')
                        .toFixed(),
                    }),
              minToAmount: rebuiltQuoteResult.minToAmount,
              providerInfo: rebuiltQuoteResult.info,
              fee: rebuiltQuoteResult.fee,
              slippage: slippagePercentage,
              swapBuildResultData: rebuiltSwapBuildResultData,
              swapBuildLoading: false,
              estimateNetworkFeeLoading: false,
              stepBeforeActionsLoading: false,
              stepBeforeActionsError: undefined,
              ...(shouldFallback
                ? {
                    shouldFallback: true,
                    needFetchGas: needFetchGasAfterRebuild,
                    supportNetworkFeeLevel: false,
                    netWorkFee: undefined,
                  }
                : {
                    shouldFallback: false,
                    needFetchGas: needFetchGasAfterRebuild,
                    supportNetworkFeeLevel: true,
                    netWorkFee: estimateNetworkFeeResult.netWorkFee,
                  }),
            },
          };
          swapStepsRef.current = nextState;
          return nextState;
        });
      } catch (error) {
        if (isCurrentRebuildContext()) {
          setSwapSteps((prev) => {
            if (!isCurrentRebuildContext(prev)) {
              return prev;
            }
            const nextState = {
              ...prev,
              preSwapData: {
                ...prev.preSwapData,
                swapBuildLoading: false,
                estimateNetworkFeeLoading: false,
              },
            };
            swapStepsRef.current = nextState;
            return nextState;
          });
        }
        throw error;
      }
    },
    [
      buildSeparateApproveAndSwapSteps,
      buildSwapAction,
      estimateNetworkFee,
      fromAccountId,
      fromAccountNetworkId,
      getApproveUnSignedTxArr,
      setSwapSteps,
      currencyMap,
      persistSettings.currencyInfo.id,
    ],
  );

  const preSwapBeforeStepActions = useCallback(
    async (
      data?: IFetchQuoteResult,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
    ) => {
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        const reviewStateAtStart = swapStepsRef.current;
        const expectedQuoteResult = reviewStateAtStart.quoteResult;
        const expectedSession = reviewStateAtStart.preSwapData.reviewSession;
        const expectedSessionFingerprint = expectedSession
          ? buildSwapReviewSessionFingerprint(expectedSession)
          : undefined;
        const expectedFeeSelectionFingerprint =
          buildSwapFeeSelectionFingerprint(swapNetworkFeeLevelRef.current);
        const isCurrentReview = (current = swapStepsRef.current): boolean =>
          isCurrentSwapReviewContext({
            current,
            expectedQuoteResult,
            expectedSession,
            expectedSessionFingerprint,
          }) &&
          buildSwapFeeSelectionFingerprint(swapNetworkFeeLevelRef.current) ===
            expectedFeeSelectionFingerprint;
        setSwapSteps((prev) => {
          if (!isCurrentReview(prev)) {
            return prev;
          }
          return {
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              stepBeforeActionsLoading: true,
              stepBeforeActionsError: undefined,
            },
          };
        });
        try {
          const { swapInfo, transferInfo, encodedTx } = await buildSwapAction(
            currentFromToken,
            currentToToken,
            data,
            { preparationPhase: 'review' },
          );
          const { unsignedTxArr } = await getApproveUnSignedTxArr(data);
          const estimateNetworkFeeResult = await estimateNetworkFee(
            fromAccountNetworkId ?? '',
            fromAccountId ?? '',
            {
              networkId: fromAccountNetworkId ?? '',
              accountId: fromAccountId ?? '',
              transfersInfo: transferInfo ? [transferInfo] : undefined,
              encodedTx,
              swapInfo,
            },
            unsignedTxArr,
          );
          if (!isCurrentReview()) {
            throw new OneKeyError(
              'Swap review changed while preparing network fee',
            );
          }
          if (estimateNetworkFeeResult.fallbackToSeparateTxConfirm) {
            const separateSteps = buildSeparateApproveAndSwapSteps(data);
            if (separateSteps.length) {
              setSwapSteps((prev) => {
                if (!isCurrentReview(prev)) {
                  return prev;
                }
                return {
                  ...prev,
                  steps: separateSteps,
                  preSwapData: {
                    ...prev.preSwapData,
                    shouldFallback: true,
                    needFetchGas: true,
                    supportNetworkFeeLevel: false,
                    netWorkFee: undefined,
                    estimateNetworkFeeLoading: false,
                    stepBeforeActionsLoading: false,
                    stepBeforeActionsError: undefined,
                  },
                };
              });
              return;
            }
          }
          setSwapSteps((prev) => {
            if (!isCurrentReview(prev)) {
              return prev;
            }
            return {
              ...prev,
              preSwapData: {
                ...prev.preSwapData,
                stepBeforeActionsLoading: false,
                stepBeforeActionsError: undefined,
              },
            };
          });
        } catch {
          setSwapSteps((prev) => {
            if (!isCurrentReview(prev)) {
              return prev;
            }
            return {
              ...prev,
              preSwapData: {
                ...prev.preSwapData,
                stepBeforeActionsLoading: false,
                stepBeforeActionsError: true,
                netWorkFee: undefined,
              },
            };
          });
        }
      }
    },
    [
      buildSwapAction,
      estimateNetworkFee,
      getApproveUnSignedTxArr,
      buildSeparateApproveAndSwapSteps,
      setSwapSteps,
      slippageItem,
      fromAccountId,
      fromAccountNetworkId,
      fromUserAddress,
      toUserAddress,
    ],
  );

  const preSwapStepsStart = useCallback(
    async (swapStepsValues?: {
      steps: ISwapStep[];
      preSwapData: ISwapPreSwapData;
      quoteResult?: IFetchQuoteResult;
    }) => {
      const swapStepsValuesFinal = swapStepsValues?.steps ?? swapSteps.steps;
      const preSwapDataFinal =
        swapStepsValues?.preSwapData ?? swapSteps.preSwapData;
      const quoteResultFinal =
        swapStepsValues?.quoteResult ?? swapSteps.quoteResult;
      const expectedQuoteResult = quoteResultFinal;
      const expectedSession = preSwapDataFinal.reviewSession;
      const expectedSessionFingerprint = expectedSession
        ? buildSwapReviewSessionFingerprint(expectedSession)
        : undefined;
      const expectedFeeSelectionFingerprint = buildSwapFeeSelectionFingerprint(
        swapNetworkFeeLevelRef.current,
      );
      const isCurrentReview = (
        current: {
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult;
        } = swapStepsRef.current,
      ): boolean =>
        isCurrentSwapReviewContext({
          current,
          expectedQuoteResult,
          expectedSession,
          expectedSessionFingerprint,
        }) &&
        buildSwapFeeSelectionFingerprint(swapNetworkFeeLevelRef.current) ===
          expectedFeeSelectionFingerprint;
      const assertCurrentReview = () => {
        if (!isCurrentReview()) {
          throw new OneKeyError('Swap review changed while executing');
        }
      };
      const executionContext: ISwapExecutionContextGuard = {
        isCurrent: isCurrentReview,
        assertCurrent: assertCurrentReview,
      };
      const updateStepIfCurrent = (
        stepIndex: number,
        partialStep: Partial<ISwapStep>,
      ) => {
        setSwapSteps((prev) => {
          if (!isCurrentReview(prev)) {
            return prev;
          }
          const nextState = {
            ...prev,
            steps: prev.steps.map((currentStep, index) =>
              index === stepIndex
                ? { ...currentStep, ...partialStep }
                : currentStep,
            ),
          };
          swapStepsRef.current = nextState;
          return nextState;
        });
      };
      const updateReviewStateIfCurrent = (
        updater: (
          prev: typeof swapStepsRef.current,
        ) => typeof swapStepsRef.current | undefined,
      ) => {
        setSwapSteps((prev) => {
          if (!isCurrentReview(prev)) {
            return prev;
          }
          const nextState = updater(prev);
          if (!nextState) {
            return prev;
          }
          swapStepsRef.current = nextState;
          return nextState;
        });
      };
      if (swapStepsValuesFinal.length > 0) {
        for (let i = 0; i < swapStepsValuesFinal.length; i += 1) {
          if (!isCurrentReview()) {
            return;
          }
          const stepIndex = i;
          const step = swapStepsValuesFinal[i];
          const { type, isResetApprove, canRetry, status } = step;
          if (
            status === ESwapStepStatus.READY ||
            (canRetry && status === ESwapStepStatus.FAILED)
          ) {
            const signAndSendProgress: ISwapStepSignAndSendProgress = {
              hasUncertainSend: false,
              succeededCount: 0,
              succeededApproveCount: 0,
            };
            const onSignAndSendProgress: ISwapSignAndSendProgressCallback = ({
              stage,
              isApprove,
            }) => {
              if (stage === 'entered') {
                signAndSendProgress.hasUncertainSend = true;
              } else {
                signAndSendProgress.hasUncertainSend = false;
                signAndSendProgress.succeededCount += 1;
                if (isApprove) {
                  signAndSendProgress.succeededApproveCount += 1;
                }
              }
            };
            try {
              assertCurrentReview();
              updateStepIfCurrent(i, {
                status: ESwapStepStatus.LOADING,
                errorMessage: undefined,
              });
              assertCurrentReview();
              if (type === ESwapStepType.APPROVE_TX) {
                let approveAmount = quoteResultFinal?.fromAmount ?? '0';
                let approveSendTx: ISignedTxPro | undefined;
                if (isResetApprove) {
                  approveAmount = '0';
                  approveSendTx = await approveTxNew(
                    stepIndex,
                    approveAmount,
                    !!swapActionState.approveUnLimit,
                    quoteResultFinal,
                    preSwapDataFinal?.shouldFallback,
                    step.shouldWaitApproved,
                    preSwapDataFinal?.needFetchGas,
                    onSignAndSendProgress,
                    executionContext,
                  );
                } else {
                  approveSendTx = await approveTxNew(
                    stepIndex,
                    approveAmount,
                    !!swapActionState.approveUnLimit,
                    quoteResultFinal,
                    preSwapDataFinal?.shouldFallback,
                    step.shouldWaitApproved,
                    preSwapDataFinal?.needFetchGas,
                    onSignAndSendProgress,
                    executionContext,
                  );
                }
                assertCurrentReview();
                if (
                  step.shouldWaitApproved ||
                  preSwapDataFinal?.shouldFallback
                ) {
                  updateStepIfCurrent(i, {
                    status: ESwapStepStatus.PENDING,
                    txHash: approveSendTx?.txid,
                    stepSubTitle: intl.formatMessage({
                      id: ETranslations.swap_btn_approving,
                    }),
                  });
                  if (
                    preSwapDataFinal?.fromToken &&
                    preSwapDataFinal?.toToken
                  ) {
                    setInAppNotificationAtom((pre) => {
                      if (
                        !isCurrentReview() ||
                        !preSwapDataFinal?.fromToken ||
                        !preSwapDataFinal?.toToken
                      ) {
                        return pre;
                      }
                      return {
                        ...pre,
                        swapApprovingTransaction: {
                          txId: approveSendTx?.txid,
                          marketSwapApprovalFlowId,
                          swapType:
                            getSwapExecutionTypeFromQuoteResult(
                              quoteResultFinal,
                            ),
                          protocol:
                            quoteResultFinal?.protocol ??
                            EProtocolOfExchange.SWAP,
                          provider: quoteResultFinal?.info.provider ?? '',
                          providerName:
                            quoteResultFinal?.info.providerName ?? '',
                          unSupportReceiveAddressDifferent:
                            quoteResultFinal?.unSupportReceiveAddressDifferent,
                          fromToken: preSwapDataFinal.fromToken,
                          toToken: preSwapDataFinal.toToken,
                          quoteId: quoteResultFinal?.quoteId ?? '',
                          amount: approveAmount,
                          toAmount: preSwapDataFinal.toTokenAmount ?? '',
                          useAddress: fromUserAddress ?? '',
                          spenderAddress:
                            preSwapDataFinal.allowanceResult?.allowanceTarget ??
                            '',
                          status: ESwapApproveTransactionStatus.PENDING,
                          kind: quoteResultFinal?.kind ?? ESwapQuoteKind.SELL,
                          resetApproveIsMax: !!swapActionState.approveUnLimit,
                        },
                      };
                    });
                  }
                  break;
                }
              } else if (type === ESwapStepType.WRAP_TX) {
                await wrappedTx(
                  stepIndex,
                  quoteResultFinal,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  preSwapDataFinal?.needFetchGas,
                  onSignAndSendProgress,
                  executionContext,
                );
                assertCurrentReview();
              } else if (type === ESwapStepType.SEND_TX) {
                await buildTxNew(
                  stepIndex,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  quoteResultFinal,
                  undefined,
                  preSwapDataFinal?.shouldFallback,
                  undefined,
                  preSwapDataFinal?.needFetchGas,
                  undefined,
                  onSignAndSendProgress,
                  executionContext,
                );
                assertCurrentReview();
              } else if (type === ESwapStepType.SIGN_MESSAGE) {
                await signMessage(
                  stepIndex,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  quoteResultFinal,
                  preSwapDataFinal?.needFetchGas,
                  executionContext,
                );
                assertCurrentReview();
              } else if (type === ESwapStepType.BATCH_APPROVE_SWAP) {
                await batchApproveSwap(
                  stepIndex,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  quoteResultFinal,
                  preSwapDataFinal?.shouldFallback,
                  preSwapDataFinal?.needFetchGas,
                  onSignAndSendProgress,
                  executionContext,
                );
                assertCurrentReview();
              }

              if (
                i !== swapStepsValuesFinal.length - 1 &&
                !preSwapDataFinal?.shouldFallback
              ) {
                updateStepIfCurrent(i, {
                  status: ESwapStepStatus.SUCCESS,
                });
              }
            } catch (error) {
              if (!isCurrentReview()) {
                break;
              }
              const shouldFallback = shouldFallbackSwapStep({
                error,
                stepType: step.type,
                signAndSendProgress,
              });
              const oneKeyError = error as IOneKeyError;
              let errorMessage: string | undefined =
                oneKeyError?.message ?? 'Unknown error';
              if (shouldFallback) {
                errorMessage = undefined;
              }
              if (oneKeyError?.key === 'global.cancel') {
                errorMessage = intl.formatMessage({
                  id: ETranslations.limit_cancel_order_title,
                });
              }
              let fallbackSwapStepsValues: {
                steps: ISwapStep[];
                preSwapData: ISwapPreSwapData;
                quoteResult?: IFetchQuoteResult | undefined;
              } = {
                steps: swapStepsRef.current.steps,
                preSwapData: swapStepsRef.current.preSwapData,
                quoteResult: swapStepsRef.current.quoteResult,
              };
              if (shouldFallback) {
                let newSteps = [...fallbackSwapStepsValues.steps];
                if (
                  step.type === ESwapStepType.BATCH_APPROVE_SWAP &&
                  signAndSendProgress.succeededApproveCount > 0
                ) {
                  newSteps = markSubmittedSwapApprovalsCompleted({
                    steps: buildSeparateApproveAndSwapSteps(quoteResultFinal),
                    succeededApproveCount:
                      signAndSendProgress.succeededApproveCount,
                  });
                } else {
                  newSteps[i] = {
                    ...newSteps[i],
                    status: ESwapStepStatus.READY,
                  };
                }
                fallbackSwapStepsValues = {
                  steps: newSteps,
                  preSwapData: {
                    ...fallbackSwapStepsValues.preSwapData,
                    shouldFallback,
                  },
                  quoteResult: fallbackSwapStepsValues.quoteResult,
                };
              }
              updateReviewStateIfCurrent((prevSteps) => {
                if (shouldFallback) {
                  return {
                    ...prevSteps,
                    steps: fallbackSwapStepsValues.steps,
                    preSwapData: fallbackSwapStepsValues.preSwapData,
                    quoteResult: fallbackSwapStepsValues.quoteResult,
                  };
                }
                const newSteps = [...prevSteps.steps];
                newSteps[i] = {
                  ...newSteps[i],
                  status: ESwapStepStatus.FAILED,
                  errorMessage,
                };
                return {
                  ...prevSteps,
                  steps: newSteps,
                  preSwapData: {
                    ...prevSteps.preSwapData,
                    shouldFallback: false,
                  },
                };
              });
              if (!isCurrentReview()) {
                break;
              }
              if (
                shouldFallback &&
                !swapStepsValues?.preSwapData.shouldFallback
              ) {
                void preSwapStepsStart(fallbackSwapStepsValues);
              } else if (
                accountUtils.isQrAccount({
                  accountId: fromAccountId ?? '',
                }) &&
                oneKeyError?.key !== 'global.cancel'
              ) {
                void goBackQrCodeModal();
              }
              break;
            }
          }
        }
      }
    },
    [
      goBackQrCodeModal,
      swapSteps.steps,
      swapSteps.preSwapData,
      swapSteps.quoteResult,
      setSwapSteps,
      approveTxNew,
      swapActionState.approveUnLimit,
      intl,
      setInAppNotificationAtom,
      marketSwapApprovalFlowId,
      fromUserAddress,
      fromAccountId,
      wrappedTx,
      buildTxNew,
      signMessage,
      batchApproveSwap,
      buildSeparateApproveAndSwapSteps,
    ],
  );

  return {
    preSwapStepsStart,
    cancelLimitOrder,
    preSwapBeforeStepActions,
    rebuildSwapWithSlippage,
    beginGasAccountReviewSession,
    endGasAccountReviewSession,
    markCurrentGasAccountReviewSubmitted,
  };
}
