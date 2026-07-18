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
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { getGasAccountErrorCode } from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
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
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  numberFormat,
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';
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
  IGasAccountUiState,
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
  useSwapReviewExecutionSnapshotAtom,
  useSwapStepNetFeeLevelAtom,
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import {
  EGasAccountErrorStrategy,
  getGasAccountErrorEntry,
} from '../../SignatureConfirm/constants/gasAccountErrorCodes';
import { buildSwapApproveAndSendSteps } from '../utils/buildSwapReviewState';
import {
  type ISwapBtcOutputValidationError,
  checkSwapLatestBalanceSufficient,
  getSwapEncodedTxSize,
  getSwapOtherFeeRequiredAmount,
  getSwapRequiredNativeBalanceAmount,
  validateSwapBtcOutputs,
} from '../utils/swapBalanceUtils';
import {
  buildSwapExecutionResultFromBuildResponse,
  isSwapSignedNoSendBuildResult,
  isSwapTerminalSignedNoSendBuildResult,
  persistSwapHistoryBestEffort,
  runSwapSideEffectBestEffort,
  settleSwapSignedNoSendResult,
} from '../utils/swapBuildExecutionResult';
import {
  assertSwapExecutionSignerMatches,
  isSwapExecutionRevisionCurrent,
  resolveSwapExecutionValues,
} from '../utils/swapExecutionSnapshotGuard';
import {
  getStockTradeAnalyticsPayload,
  getSwapAnalyticsCategoryFromSwapType,
} from '../utils/swapStockAnalytics';
import { getSwapExecutionTypeFromQuoteResult } from '../utils/swapTypeUtils';

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

function logSwapHistoryPersistenceError(error: unknown) {
  try {
    defaultLogger.app.error.log(
      `Persist swap history failed after execution: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } catch {
    // Logging must not change an already-completed execution result.
  }
}

function logSwapPostExecutionSideEffectError(error: unknown) {
  try {
    defaultLogger.app.error.log(
      `Settle swap result locally failed after execution: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } catch {
    // Logging must not change an already-completed execution result.
  }
}

type ISwapGasFeeInfo = {
  encodeTx: IEncodedTx;
  gasInfo: ISwapGasInfo;
  txSize?: number;
};

type ISwapSendTxResult = ISignedTxPro & {
  gasFeeFiatValue?: string;
  gasFeeInNative?: string;
};

type IEstimateNetworkFeeResult = {
  fallbackToSeparateTxConfirm?: boolean;
};

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

/**
 * React hook that manages the full lifecycle of building, approving, signing, and sending swap transactions in a multi-step workflow.
 *
 * Integrates with background APIs, handles UI state updates, fee checks, error handling, and event logging for swap operations. Supports various swap protocols, approval flows, limit order cancellation, and fallback UI confirmations. Returns functions to start the swap steps execution and to cancel limit orders.
 *
 * @returns An object with `preSwapStepsStart` to initiate the swap steps process and `cancelLimitOrder` to cancel a limit order.
 */
export function useSwapBuildTx() {
  const intl = useIntl();
  const {
    currentQuoteRes: liveSelectQuote,
    fromSelectToken: liveFromToken,
    toSelectToken: liveToToken,
  } = useSwapBuildTxInfo();
  const { slippageItem: liveSlippageItem } =
    useSwapSlippagePercentageModeInfo();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [, setInAppNotificationAtom] = useInAppNotificationAtom();
  const [liveSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [executionSnapshot] = useSwapReviewExecutionSnapshotAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const swapProAccount = useSwapProAccount();
  const focusSwapPro = useMemo(() => {
    return (
      platformEnv.isNative && liveSwapTypeSwitch === ESwapTabSwitchType.LIMIT
    );
  }, [liveSwapTypeSwitch]);
  const liveFromUserAddress = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.addressDetail.address;
    }
    return swapFromAddressInfo.address;
  }, [
    focusSwapPro,
    swapProAccount.result?.addressDetail.address,
    swapFromAddressInfo.address,
  ]);
  const liveToUserAddress = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.addressDetail.address;
    }
    return swapToAddressInfo.address;
  }, [
    focusSwapPro,
    swapProAccount.result?.addressDetail.address,
    swapToAddressInfo.address,
  ]);
  const liveFromAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.id;
    }
    return swapFromAddressInfo.accountInfo?.account?.id;
  }, [
    focusSwapPro,
    swapProAccount.result?.id,
    swapFromAddressInfo.accountInfo?.account?.id,
  ]);
  const liveToAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.id;
    }
    return swapToAddressInfo.accountInfo?.account?.id;
  }, [
    focusSwapPro,
    swapProAccount.result?.id,
    swapToAddressInfo.accountInfo?.account?.id,
  ]);
  const liveFromAccountIndexedAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.indexedAccountId;
    }
    return swapFromAddressInfo.accountInfo?.indexedAccount?.id;
  }, [
    focusSwapPro,
    swapProAccount.result?.indexedAccountId,
    swapFromAddressInfo.accountInfo?.indexedAccount?.id,
  ]);
  const liveFromAccountNetworkId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.addressDetail.networkId;
    }
    return swapFromAddressInfo.networkId;
  }, [
    focusSwapPro,
    swapProAccount.result?.addressDetail.networkId,
    swapFromAddressInfo.networkId,
  ]);
  const liveDbAccountId = useMemo(() => {
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
  const [liveSwapLimitExpirationTime] = useSwapLimitExpirationTimeAtom();
  const [liveSwapLimitPriceFromAmount] = useSwapLimitPriceFromAmountAtom();
  const [liveSwapLimitPriceToAmount] = useSwapLimitPriceToAmountAtom();
  const [liveSwapLimitPartiallyFillObj] = useSwapLimitPartiallyFillAtom();
  const executionValues = useMemo(
    () =>
      resolveSwapExecutionValues({
        snapshot: executionSnapshot,
        live: {
          accountId: liveFromAccountId,
          indexedAccountId: liveFromAccountIndexedAccountId,
          dbAccountId: liveDbAccountId,
          networkId: liveFromAccountNetworkId,
          senderAddress: liveFromUserAddress,
          receivingAccountId: liveToAccountId,
          receivingAddress: liveToUserAddress,
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          walletType: swapFromAddressInfo.accountInfo?.wallet?.type,
          deriveType: swapFromAddressInfo.accountInfo?.deriveType,
          addressEncoding:
            swapFromAddressInfo.accountInfo?.deriveInfo?.addressEncoding,
          swapType: liveSwapTypeSwitch,
          fromToken: liveFromToken,
          toToken: liveToToken,
          quoteResult: liveSelectQuote,
          slippage: liveSlippageItem.value,
          limitSettings: {
            expirationTime: liveSwapLimitExpirationTime.value,
            priceFromAmount: liveSwapLimitPriceFromAmount,
            priceToAmount: liveSwapLimitPriceToAmount,
            partiallyFillable: liveSwapLimitPartiallyFillObj.value,
          },
        },
      }),
    [
      executionSnapshot,
      liveDbAccountId,
      liveFromAccountId,
      liveFromAccountIndexedAccountId,
      liveFromAccountNetworkId,
      liveFromToken,
      liveFromUserAddress,
      liveSelectQuote,
      liveSlippageItem.value,
      liveSwapLimitExpirationTime.value,
      liveSwapLimitPartiallyFillObj.value,
      liveSwapLimitPriceFromAmount,
      liveSwapLimitPriceToAmount,
      liveSwapTypeSwitch,
      liveToAccountId,
      liveToToken,
      liveToUserAddress,
      swapFromAddressInfo.accountInfo?.deriveInfo?.addressEncoding,
      swapFromAddressInfo.accountInfo?.deriveType,
      swapFromAddressInfo.accountInfo?.wallet?.id,
      swapFromAddressInfo.accountInfo?.wallet?.type,
    ],
  );
  const selectQuote = executionValues.quoteResult;
  const fromToken = executionValues.fromToken;
  const toToken = executionValues.toToken;
  const fromUserAddress = executionValues.senderAddress;
  const toUserAddress = executionValues.receivingAddress;
  const fromAccountId = executionValues.accountId;
  const toAccountId = executionValues.receivingAccountId;
  const fromAccountIndexedAccountId = executionValues.indexedAccountId;
  const fromAccountNetworkId = executionValues.networkId;
  const dbAccountId = executionValues.dbAccountId;
  const fromWalletType = executionValues.walletType;
  const fromAddressEncoding = executionValues.addressEncoding;
  const slippageItem = useMemo(
    () => ({ ...liveSlippageItem, value: executionValues.slippage }),
    [executionValues.slippage, liveSlippageItem],
  );
  const swapLimitExpirationTime = useMemo(
    () => ({
      ...liveSwapLimitExpirationTime,
      value: executionValues.limitSettings.expirationTime,
    }),
    [executionValues.limitSettings.expirationTime, liveSwapLimitExpirationTime],
  );
  const swapLimitPriceFromAmount =
    executionValues.limitSettings.priceFromAmount;
  const swapLimitPriceToAmount = executionValues.limitSettings.priceToAmount;
  const swapLimitPartiallyFillObj = useMemo(
    () => ({
      ...liveSwapLimitPartiallyFillObj,
      value: executionValues.limitSettings.partiallyFillable,
    }),
    [
      executionValues.limitSettings.partiallyFillable,
      liveSwapLimitPartiallyFillObj,
    ],
  );
  const executionSnapshotRef = useRef(executionSnapshot);
  if (executionSnapshotRef.current !== executionSnapshot) {
    executionSnapshotRef.current = executionSnapshot;
  }
  const assertExecutionSignerUnchanged = useCallback(() => {
    assertSwapExecutionSignerMatches({
      snapshot: executionSnapshotRef.current,
      currentAccountId: liveFromAccountId,
      currentNetworkId: liveFromAccountNetworkId,
      currentSenderAddress: liveFromUserAddress,
    });
  }, [liveFromAccountId, liveFromAccountNetworkId, liveFromUserAddress]);
  const isExecutionRevisionCurrent = useCallback(
    (expectedRevision?: string) =>
      isSwapExecutionRevisionCurrent({
        expectedRevision,
        currentSnapshot: executionSnapshotRef.current,
      }),
    [],
  );
  const [swapSteps, setSwapSteps] = useSwapStepsAtom();
  const [{ isFirstTimeSwap }, setPersistSettings] = useSettingsPersistAtom();
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
  if (swapStepsRef.current !== swapSteps) {
    swapStepsRef.current = swapSteps;
  }

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
      operationRevision?: string,
    ) => {
      if (swapInfo) {
        if (isExecutionRevisionCurrent(operationRevision)) {
          runSwapSideEffectBestEffort({
            action: () => {
              clearQuoteData();
              setSwapSteps(
                (prevSteps: {
                  steps: ISwapStep[];
                  preSwapData: ISwapPreSwapData;
                  quoteResult?: IFetchQuoteResult | undefined;
                }) => {
                  const newSteps = [...prevSteps.steps];
                  newSteps[newSteps.length - 1] = {
                    ...newSteps[newSteps.length - 1],
                    status: ESwapStepStatus.PENDING,
                    txHash: txId,
                    orderId,
                  };
                  return {
                    ...prevSteps,
                    steps: newSteps,
                  };
                },
              );
              if (
                accountUtils.isQrAccount({
                  accountId: fromAccountId ?? '',
                })
              ) {
                void goBackQrCodeModal();
              }
            },
            onError: logSwapPostExecutionSideEffectError,
          });
        }
        const historyPersisted = await persistSwapHistoryBestEffort({
          persistHistory: () =>
            generateSwapHistoryItem({
              txId,
              swapTxInfo: swapInfo,
              gasFeeFiatValue,
              gasFeeInNative,
            }),
          onHistoryError: logSwapHistoryPersistenceError,
        });
        if (
          historyPersisted &&
          swapInfo.sender.token.networkId === swapInfo.receiver.token.networkId
        ) {
          void backgroundApiProxy.serviceNotification
            .blockNotificationForTxId({
              networkId: swapInfo.sender.token.networkId,
              tx: txId,
            })
            .catch(logSwapHistoryPersistenceError);
        }
      }
    },
    [
      clearQuoteData,
      goBackQrCodeModal,
      generateSwapHistoryItem,
      setSwapSteps,
      fromAccountId,
      isExecutionRevisionCurrent,
    ],
  );

  const handleBuildTxSuccessWithSignedNoSend = useCallback(
    async ({
      swapInfo,
      orderId,
      operationRevision,
    }: {
      orderId?: string;
      swapInfo: ISwapTxInfo;
      operationRevision?: string;
    }) => {
      if (swapInfo) {
        await settleSwapSignedNoSendResult({
          isRevisionCurrent: isExecutionRevisionCurrent(operationRevision),
          onCurrentRevision: () => {
            clearQuoteData();
            if (
              accountUtils.isQrAccount({
                accountId: fromAccountId ?? '',
              })
            ) {
              rootNavigationRef.current?.goBack();
            }
            setSwapSteps(
              (prevSteps: {
                steps: ISwapStep[];
                preSwapData: ISwapPreSwapData;
                quoteResult?: IFetchQuoteResult | undefined;
              }) => {
                const newSteps = [...prevSteps.steps];
                newSteps[newSteps.length - 1] = {
                  ...newSteps[newSteps.length - 1],
                  status: ESwapStepStatus.PENDING,
                  orderId,
                };
                return {
                  ...prevSteps,
                  steps: newSteps,
                };
              },
            );
          },
          persistHistory: () =>
            generateSwapHistoryItem({
              swapTxInfo: swapInfo,
            }),
          onHistoryError: logSwapHistoryPersistenceError,
        });
      }
    },
    [
      clearQuoteData,
      generateSwapHistoryItem,
      setSwapSteps,
      fromAccountId,
      isExecutionRevisionCurrent,
    ],
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
            const finalTokenAmount = getSwapOtherFeeRequiredAmount({
              feeAmount: item.amount,
              feeToken: item.token,
              fromAmount: selectQuote?.fromAmount,
              fromToken,
            });
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
                  reserveAmount: new BigNumber(item.amount ?? 0).toFixed(),
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
    }: {
      gasInfos?: { gasInfo?: ISwapGasInfo; txSize?: number }[];
      networkId?: string;
      token?: ISwapToken;
      amount?: string;
      otherFeeInfos?: IQuoteResultFeeOtherFeeInfo[];
    }) => {
      const nativeBalanceRequirement = getSwapRequiredNativeBalanceAmount({
        gasInfos,
        networkId,
        fromToken: token,
        fromAmount: amount,
        otherFeeInfos,
      });

      if (!nativeBalanceRequirement) {
        return true;
      }

      const checkResult = await checkSwapLatestBalanceSufficient({
        token: nativeBalanceRequirement.token,
        amount: nativeBalanceRequirement.amount,
        accountAddress: fromUserAddress,
        accountId: fromAccountId,
      });
      if (!checkResult.isSufficient) {
        const toastId = [
          'swap-native-balance-insufficient',
          nativeBalanceRequirement.token.networkId,
          checkResult.tokenSymbol,
          nativeBalanceRequirement.reserveAmount,
        ].join('-');
        const { title, message } = getSwapBalanceInsufficientToast({
          networkId: nativeBalanceRequirement.token.networkId,
          tokenSymbol: checkResult.tokenSymbol,
          reserveAmount: nativeBalanceRequirement.includesFromAmount
            ? undefined
            : nativeBalanceRequirement.reserveAmount,
        });
        Toast.error({
          title,
          message,
          toastId,
        });
        return false;
      }
      return true;
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
      operationRevision,
    }: {
      stepIndex: number;
      networkId: string;
      accountId: string;
      unsignedTxItem: IUnsignedTxPro;
      gasInfo: ISwapGasInfo;
      operationRevision?: string;
    }) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
      assertExecutionSignerUnchanged();
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
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
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
      });
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
      if (!checkLatestNativeBalanceRes) {
        throw new OneKeyAppError('checkLatestNativeTokenBalance failed');
      }
      setSwapSteps(
        (prev: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
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
      await backgroundApiProxy.serviceSend.precheckUnsignedTxs({
        networkId,
        accountId,
        unsignedTxs: [updatedUnsignedTxItem],
        precheckTiming: ESendPreCheckTimingEnum.Confirm,
      });
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
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
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
      // When estimate-fee confirmed Gas Account sponsorship, attach the quote so
      // broadcast pays via the sponsor. Mirrors the transaction-confirm page
      // (TxFeeInfo): selectedPayer 'gasAccount' + `gas-account:${quoteId}` key.
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
      };
      let res: Awaited<
        ReturnType<typeof backgroundApiProxy.serviceSend.signAndSendTransaction>
      >;
      assertExecutionSignerUnchanged();
      try {
        res = await backgroundApiProxy.serviceSend.signAndSendTransaction({
          ...sendTxParams,
          gasAccountUiState,
        });
      } catch (e) {
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return undefined;
        }
        // Broadcast failed at the gas-account layer. Route by the same strategy
        // table the confirm page (TxConfirmActions) uses. Plain (non
        // gas-account) errors, and errors on a non-sponsored send, propagate.
        const entry = gasAccountUiState
          ? getGasAccountErrorEntry(getGasAccountErrorCode(e))
          : undefined;
        if (!entry) {
          throw e;
        }
        // Mute the original bridge error so the global handler doesn't toast it
        // (would duplicate the mapped message / conflict with suppressToast).
        (e as IOneKeyError).autoToast = false;
        const message = intl.formatMessage({ id: entry.messageKey });
        // Honor the suppressToast contract (e.g. daily-limit codes stay silent).
        if (!entry.suppressToast) {
          Toast.error({ title: message });
        }
        if (entry.strategy === EGasAccountErrorStrategy.Fallback) {
          // Sponsor path unavailable for this attempt (pool exhausted, daily
          // limit, sponsor down …). Mirror the confirm page: drop the sponsor
          // quote and resend once as user-paid so the swap can still go through
          // when the user has native for gas. A user-paid failure (e.g. no
          // native) then propagates honestly.
          assertExecutionSignerUnchanged();
          res =
            await backgroundApiProxy.serviceSend.signAndSendTransaction(
              sendTxParams,
            );
        } else {
          // Refresh (quote/nonce stale — already prevented in Swap by the
          // fresh estimate-at-send + locked nonce) and Hint (terminal) fail the
          // step. OneKeyAppError avoids the tx-confirm fallback and a 2nd toast.
          throw new OneKeyAppError({ message, autoToast: false });
        }
      }
      if (!res.txid) {
        throw new OneKeyError('Transaction broadcast receipt is missing txid');
      }
      await persistSwapHistoryBestEffort({
        persistHistory: async () => {
          const decodedTx = await backgroundApiProxy.serviceSend.buildDecodedTx(
            {
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
            },
          );
          await backgroundApiProxy.serviceHistory.saveSendConfirmHistoryTxs({
            networkId,
            accountId,
            data: {
              signedTx: res,
              decodedTx,
              approveInfo: updatedUnsignedTxItem.approveInfo,
              feeInfo: gasInfo as IFeeInfoUnit,
            },
          });
        },
        onHistoryError: logSwapHistoryPersistenceError,
      });
      return {
        ...res,
        gasFeeFiatValue: totalFiatForDisplay,
        gasFeeInNative: totalNativeForDisplay,
      };
    },
    [
      checkLatestNativeTokenBalance,
      assertExecutionSignerUnchanged,
      getSwapBtcOutputValidationToast,
      intl,
      isExecutionRevisionCurrent,
      setSwapSteps,
    ],
  );

  const swapEstimateFeeEvent = useCallback(
    (
      status: ESwapEventAPIStatus,
      networkId: string,
      accountId: string,
      message?: string,
      encodedTx?: unknown,
      swapInfo?: ISwapTxInfo,
      isBatch?: boolean,
    ) => {
      runSwapSideEffectBestEffort({
        action: () => {
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
            providerName:
              swapInfo?.swapBuildResData.result.info.providerName ?? '',
            networkId,
            accountId,
            encodedTx: JSON.stringify(encodedTx ?? ''),
            isBatch,
          });
        },
        onError: logSwapPostExecutionSideEffectError,
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
      encodedTx?: unknown,
      swapInfo?: ISwapTxInfo,
      quoteResult?: IFetchQuoteResult,
    ) => {
      runSwapSideEffectBestEffort({
        action: () => {
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
            providerName:
              swapInfo?.swapBuildResData.result.info.providerName ?? '',
            networkId,
            accountId,
            encodedTx: JSON.stringify(encodedTx ?? ''),
          });
        },
        onError: logSwapPostExecutionSideEffectError,
      });
    },
    [slippageItem.value, fromUserAddress, toUserAddress],
  );

  const handleApproveFallbackOnSuccess = useCallback(
    (
      stepIndex: number,
      res?: ISendTxOnSuccessData[],
      shouldWaitApprove?: boolean,
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return;
      }
      if (res?.[0]) {
        const transactionSignedInfo = res[0].signedTx;
        const approveInfo = res[0].approveInfo;
        const txId = transactionSignedInfo.txid;
        runSwapSideEffectBestEffort({
          action: () => {
            setInAppNotificationAtom((prev) => {
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
          },
          onError: logSwapPostExecutionSideEffectError,
        });
      }
    },
    [isExecutionRevisionCurrent, setInAppNotificationAtom, setSwapSteps],
  );
  const handleApproveFallbackOnCancel = useCallback(
    (stepIndex: number, operationRevision?: string) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return;
      }
      setSwapSteps(
        (prevSteps: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
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
    [isExecutionRevisionCurrent, setSwapSteps],
  );

  const handleBuildTxFallbackOnSuccess = useCallback(
    async (
      res?: ISendTxOnSuccessData[],
      orderId?: string,
      operationRevision?: string,
    ) => {
      if (res?.[0]) {
        runSwapSideEffectBestEffort({
          action: () => {
            const transactionSignedInfo = res[0].signedTx;
            const txId = transactionSignedInfo.txid;
            const { swapInfo } = transactionSignedInfo;
            const transactionDecodedInfo = res[0].decodedTx;
            const { totalFeeInNative, totalFeeFiatValue } =
              transactionDecodedInfo;
            if (swapInfo) {
              void onBuildTxSuccess(
                txId,
                swapInfo,
                orderId,
                totalFeeFiatValue,
                totalFeeInNative,
                operationRevision,
              ).catch(logSwapPostExecutionSideEffectError);
            }
          },
          onError: logSwapPostExecutionSideEffectError,
        });
      }
    },
    [onBuildTxSuccess],
  );

  const handleBuildTxFallbackOnCancel = useCallback(
    async (stepIndex: number, operationRevision?: string) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return;
      }
      setSwapSteps(
        (prev: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
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
    [isExecutionRevisionCurrent, setSwapSteps],
  );

  const updateStepTitle = useCallback(
    (stepIndex: number, i: number, approveUnsignedTxArr?: IUnsignedTxPro[]) => {
      if (swapStepsRef.current?.preSwapData?.isHWAndExBatchTransfer) {
        setSwapSteps(
          (prev: {
            steps: ISwapStep[];
            preSwapData: ISwapPreSwapData;
            quoteResult?: IFetchQuoteResult | undefined;
          }) => {
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
      }
    },
    [intl, setSwapSteps],
  );

  const onApproveTxSuccess = useCallback(() => {
    runSwapSideEffectBestEffort({
      action: () => {
        if (
          accountUtils.isQrAccount({
            accountId: fromAccountId ?? '',
          })
        ) {
          goBackQrCodeModal();
        }
      },
      onError: logSwapPostExecutionSideEffectError,
    });
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
        swapNetWorkFeeLevel?.networkFeeLevel &&
        swapNetWorkFeeLevel.networkFeeLevel === ESwapNetworkFeeLevel.LOW
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
        swapNetWorkFeeLevel?.networkFeeLevel &&
        swapNetWorkFeeLevel.networkFeeLevel === ESwapNetworkFeeLevel.HIGH
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
        customPriorityFee: swapNetWorkFeeLevel?.customPriorityFee,
        estimateFeeParams,
      });
      // Carry sponsorship result from estimate-fee so it flows into the preview
      // badge and, for Gas Account, the send path broadcast quoteId.
      return {
        ...gasInfo,
        megafuelEligible: gasRes.megafuelEligible,
        payer: gasRes.payer,
        gasAccountEligible: gasRes.gasAccountEligible,
        gasAccountQuote: gasRes.gasAccountQuote,
      };
    },
    [
      swapNetWorkFeeLevel?.networkFeeLevel,
      swapNetWorkFeeLevel?.customPriorityFee,
    ],
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
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
      assertExecutionSignerUnchanged();
      if (!fromToken || !fromAccountId || !fromUserAddress) {
        throw new OneKeyError('account error');
      }
      const stepGasInfos =
        swapStepsRef.current.preSwapData.netWorkFee?.gasInfos;
      const swapInfo = buildUnsignedParams?.swapInfo;
      // Backend Gas Account pre-check from the build-tx response. When the
      // sponsorship candidate flag is on we must re-run estimate-fee right
      // before sending to obtain a fresh, non-expired gasAccountQuote.quoteId,
      // so we skip the cached-gas fast path below for sponsored swaps.
      const isGasAccountEnabled =
        !!swapInfo?.swapBuildResData?.result?.gasAccountEnabled;
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
      // The final broadcast result must still reach onBuildTxSuccess so swap
      // history is persisted. That callback gates all UI writes by this
      // operation revision, while intermediate approvals stop immediately.
      let lastTxRes: ISwapSendTxResult | undefined;
      const unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          ...buildUnsignedParamsCheckNonce,
          isInternalSwap: true,
        });
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
      const vaultSettings =
        await backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId,
        });
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
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
          !needFetchGas
        ) {
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            const gasInfoFinal = findGasInfo(
              stepGasInfos ?? [],
              unsignedTxItem.encodedTx,
            )?.gasInfo;
            if (gasInfoFinal) {
              try {
                if (!isExecutionRevisionCurrent(operationRevision)) {
                  return undefined;
                }
                updateStepTitle(stepIndex, i, approveUnsignedTxArr);
                const res = await updateUnsignedTxAndSendTx({
                  stepIndex,
                  networkId,
                  accountId,
                  unsignedTxItem,
                  gasInfo: gasInfoFinal,
                  operationRevision,
                });
                if (i === unsignedTxArr.length - 1) {
                  lastTxRes = res;
                  if (!isExecutionRevisionCurrent(operationRevision)) {
                    return lastTxRes;
                  }
                } else {
                  if (!isExecutionRevisionCurrent(operationRevision)) {
                    return undefined;
                  }
                  void onApproveTxSuccess();
                }
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.SUCCESS,
                    networkId,
                    accountId,
                    undefined,
                    unsignedTxItem.encodedTx,
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
                    unsignedTxItem.encodedTx,
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
          if (!isExecutionRevisionCurrent(operationRevision)) {
            return undefined;
          }
          try {
            const gasResArr =
              await backgroundApiProxy.serviceGas.batchEstimateFee({
                networkId,
                accountId,
                encodedTxs: estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
              });
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return undefined;
            }
            if (!isApprove) {
              void swapEstimateFeeEvent(
                ESwapEventAPIStatus.SUCCESS,
                networkId,
                accountId,
                undefined,
                estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
                swapInfo,
                true,
              );
            }
            for (let i = 0; i < unsignedTxArr.length; i += 1) {
              const unsignedTxItem = unsignedTxArr[i];
              const gasRes = gasResArr.txFees[i];
              const gasInfo = buildGasInfo(
                gasRes,
                gasResArr.common,
                estimateFeeParamsArr[i].estimateFeeParams,
              );
              try {
                if (!isExecutionRevisionCurrent(operationRevision)) {
                  return undefined;
                }
                updateStepTitle(stepIndex, i, approveUnsignedTxArr);
                const res = await updateUnsignedTxAndSendTx({
                  stepIndex,
                  networkId,
                  accountId,
                  unsignedTxItem,
                  gasInfo,
                  operationRevision,
                });
                if (i === unsignedTxArr.length - 1) {
                  lastTxRes = res;
                  if (!isExecutionRevisionCurrent(operationRevision)) {
                    return lastTxRes;
                  }
                } else {
                  if (!isExecutionRevisionCurrent(operationRevision)) {
                    return undefined;
                  }
                  void onApproveTxSuccess();
                }
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.SUCCESS,
                    networkId,
                    accountId,
                    undefined,
                    unsignedTxItem.encodedTx,
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
                    unsignedTxItem.encodedTx,
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
                estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
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
          !needFetchGas
        ) {
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            const gasInfoFinal = findGasInfo(
              stepGasInfos ?? [],
              unsignedTxItem.encodedTx,
            )?.gasInfo;
            if (gasInfoFinal) {
              try {
                if (!isExecutionRevisionCurrent(operationRevision)) {
                  return undefined;
                }
                updateStepTitle(stepIndex, i, approveUnsignedTxArr);
                const res = await updateUnsignedTxAndSendTx({
                  stepIndex,
                  networkId,
                  accountId,
                  unsignedTxItem,
                  gasInfo: gasInfoFinal,
                  operationRevision,
                });
                if (i === unsignedTxArr.length - 1) {
                  lastTxRes = res;
                  if (!isExecutionRevisionCurrent(operationRevision)) {
                    return lastTxRes;
                  }
                } else {
                  if (!isExecutionRevisionCurrent(operationRevision)) {
                    return undefined;
                  }
                  void onApproveTxSuccess();
                }
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.SUCCESS,
                    networkId,
                    accountId,
                    undefined,
                    unsignedTxItem.encodedTx,
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
                    unsignedTxItem.encodedTx,
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
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return undefined;
              }
              updateStepTitle(stepIndex, i, approveUnsignedTxArr);
              lastTxRes = await updateUnsignedTxAndSendTx({
                stepIndex,
                networkId,
                accountId,
                unsignedTxItem,
                gasInfo: lastTxGasInfo,
                operationRevision,
              });
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return lastTxRes;
              }
            } else {
              const estimateFeeParams =
                await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                  networkId,
                  accountId,
                  encodedTx: unsignedTxItem.encodedTx,
                });
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return undefined;
              }
              const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
                ...estimateFeeParams,
                accountAddress: fromUserAddress,
                networkId,
                accountId,
                scenario: 'swap',
              });
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return undefined;
              }
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
              updateStepTitle(stepIndex, i, approveUnsignedTxArr);
              await updateUnsignedTxAndSendTx({
                stepIndex,
                networkId,
                accountId,
                unsignedTxItem,
                gasInfo: gasParseInfo,
                operationRevision,
              });
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return undefined;
              }
              void onApproveTxSuccess();
            }
          }
        }
      } else if (
        findGasInfo(stepGasInfos ?? [], unsignedTx.encodedTx) &&
        !needFetchGas &&
        !isGasAccountEnabled
      ) {
        const gasInfoFinal = findGasInfo(
          stepGasInfos ?? [],
          unsignedTx.encodedTx,
        )?.gasInfo;
        if (gasInfoFinal) {
          try {
            lastTxRes = await updateUnsignedTxAndSendTx({
              stepIndex,
              networkId,
              accountId,
              unsignedTxItem: unsignedTx,
              gasInfo: gasInfoFinal,
              operationRevision,
            });
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return lastTxRes;
            }
          } catch (e: any) {
            if (!isApprove) {
              void swapSendTxEvent(
                ESwapEventAPIStatus.FAIL,
                networkId,
                accountId,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                e?.message ?? 'unknown error',
                unsignedTx.encodedTx,
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
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return undefined;
        }
        try {
          const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
            ...estimateFeeParams,
            accountAddress: fromUserAddress,
            networkId,
            accountId,
            scenario: 'swap',
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
          if (!isExecutionRevisionCurrent(operationRevision)) {
            return undefined;
          }
          if (!isApprove) {
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.SUCCESS,
              networkId,
              accountId,
              undefined,
              unsignedTx.encodedTx,
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
              stepIndex,
              networkId,
              accountId,
              unsignedTxItem: unsignedTx,
              gasInfo: gasParseInfo,
              operationRevision,
            });
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return lastTxRes;
            }
            if (!isApprove) {
              void swapSendTxEvent(
                ESwapEventAPIStatus.SUCCESS,
                networkId,
                accountId,
                undefined,
                unsignedTx.encodedTx,
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
                unsignedTx.encodedTx,
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
              unsignedTx.encodedTx,
              swapInfo,
            );
          }
          throw e;
        }
      }
      return lastTxRes;
    },
    [
      assertExecutionSignerUnchanged,
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
      isExecutionRevisionCurrent,
    ],
  );

  const getApproveUnsignedTx = useCallback(
    async (
      amount: string,
      isMax: boolean,
      data?: IFetchQuoteResult,
      prevNonce?: number,
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return { unsignedTx: undefined, approveInfo: undefined };
      }
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
          if (!isExecutionRevisionCurrent(operationRevision)) {
            return { unsignedTx: undefined, approveInfo: undefined };
          }
          return { unsignedTx, approveInfo };
        }
      }
      return { unsignedTx: undefined, approveInfo: undefined };
    },
    [fromAccountId, fromUserAddress, isExecutionRevisionCurrent],
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
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
      assertExecutionSignerUnchanged();
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
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return undefined;
            }
            assertExecutionSignerUnchanged();
            await navigationToTxConfirm({
              isInternalSwap: true,
              approvesInfo: [approveInfo],
              onSuccess: (successData: ISendTxOnSuccessData[]) =>
                handleApproveFallbackOnSuccess(
                  stepIndex,
                  successData,
                  shouldWaitApprove,
                  operationRevision,
                ),
              onCancel: () =>
                handleApproveFallbackOnCancel(stepIndex, operationRevision),
            });
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return undefined;
            }
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
              operationRevision,
            );
            if (res && isExecutionRevisionCurrent(operationRevision)) {
              void onApproveTxSuccess();
            }
            return res;
          }
        }
      }
    },
    [
      assertExecutionSignerUnchanged,
      onApproveTxSuccess,
      handleApproveFallbackOnCancel,
      handleApproveFallbackOnSuccess,
      navigationToTxConfirm,
      sendTxActions,
      fromAccountId,
      fromUserAddress,
      isExecutionRevisionCurrent,
    ],
  );

  const swapBuildFinish = useCallback(
    async (
      buildSwapRes: { orderId?: string; result?: IFetchQuoteResult },
      quoteResult?: IFetchQuoteResult,
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return;
      }
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
        slippage: slippageItem.value.toString(),
        sourceChain: buildSwapRes.result?.fromTokenInfo.networkId ?? '',
        receivedChain: buildSwapRes.result?.toTokenInfo.networkId ?? '',
        sourceTokenSymbol: buildSwapRes.result?.fromTokenInfo.symbol ?? '',
        receivedTokenSymbol: buildSwapRes.result?.toTokenInfo.symbol ?? '',
        feeType: buildSwapRes.result?.fee?.percentageFee?.toString() ?? '0',
        router: JSON.stringify(buildSwapRes.result?.routesData ?? ''),
        isFirstTime: isFirstTimeSwap,
        createFrom: isModalPage ? 'modal' : 'swapPage',
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
      isExecutionRevisionCurrent,
    ],
  );

  const buildSwapAction = useCallback(
    async (
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
      skipLoading?: boolean,
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return {};
      }
      assertExecutionSignerUnchanged();
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
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return {};
        }
        if (!checkLatestBalanceRes) {
          throw new OneKeyAppError('checkLatestFromTokenBalance failed');
        }
        const checkRes = await checkOtherFee(data);
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return {};
        }
        if (!checkRes) {
          throw new OneKeyAppError('checkOtherFee failed');
        }
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return {};
        }
        if (swapStepsRef.current.preSwapData.swapBuildResultData) {
          return swapStepsRef.current.preSwapData.swapBuildResultData;
        }
        let buildSwapRes: IFetchBuildTxResponse | undefined;
        try {
          if (!skipLoading) {
            setSwapSteps((prev) => ({
              ...prev,
              preSwapData: {
                ...prev.preSwapData,
                swapBuildLoading: true,
              },
            }));
          }
          buildSwapRes = await backgroundApiProxy.serviceSwap.fetchBuildTx({
            fromToken: data.fromTokenInfo,
            toToken: data.toTokenInfo,
            toTokenAmount: data.toAmount,
            fromTokenAmount: data.fromAmount,
            slippagePercentage:
              data.protocol === EProtocolOfExchange.STOCK
                ? (data.slippage ?? slippageItem.value)
                : slippageItem.value,
            receivingAddress: toUserAddress ?? '',
            userAddress: fromUserAddress,
            provider: data.info.provider,
            accountId: fromAccountId ?? '',
            quoteResultCtx: data.quoteResultCtx,
            protocol: data.protocol ?? EProtocolOfExchange.SWAP,
            kind: data.kind ?? ESwapQuoteKind.SELL,
            walletType: fromWalletType ?? '',
          });
          if (!isExecutionRevisionCurrent(operationRevision)) {
            if (
              buildSwapRes &&
              isSwapTerminalSignedNoSendBuildResult(buildSwapRes)
            ) {
              const { orderId, swapInfo } =
                buildSwapExecutionResultFromBuildResponse({
                  buildSwapRes,
                  currentFromToken,
                  currentToToken,
                  fromAccountId,
                  fromUserAddress,
                  quoteResult: data,
                  slippage: slippageItem.value,
                  toAccountId,
                  toUserAddress,
                });
              await handleBuildTxSuccessWithSignedNoSend({
                orderId,
                swapInfo,
                operationRevision,
              });
            }
            return {};
          }
        } catch (e: any) {
          if (!isExecutionRevisionCurrent(operationRevision)) {
            return {};
          }
          if (!skipLoading) {
            setSwapSteps((prev) => ({
              ...prev,
              preSwapData: {
                ...prev.preSwapData,
                swapBuildLoading: false,
              },
            }));
          }
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
            slippage: slippageItem.value.toString(),
            sourceChain: data?.fromTokenInfo.networkId ?? '',
            receivedChain: data?.toTokenInfo.networkId ?? '',
            sourceTokenSymbol: data?.fromTokenInfo.symbol ?? '',
            receivedTokenSymbol: data?.toTokenInfo.symbol ?? '',
            feeType: data?.fee?.percentageFee?.toString() ?? '0',
            router: JSON.stringify(data?.routesData ?? ''),
            isFirstTime: isFirstTimeSwap,
            createFrom: isModalPage ? 'modal' : 'swapPage',
            orderId: buildSwapRes?.orderId ?? '',
            orderType: getSwapAnalyticsCategoryFromSwapType(swapType),
            ...getStockTradeAnalyticsPayload({
              protocol: data?.protocol,
              fromToken: data?.fromTokenInfo,
              toToken: data?.toTokenInfo,
            }),
          });
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const ne = new Error(e?.message ?? 'unknown error');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ne.name = 'buildSwapApi';
          throw ne;
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
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return {};
            }
          } else if (buildSwapRes?.LMTronObject) {
            encodedTx =
              await backgroundApiProxy.serviceSwap.buildLMSwapEncodedTx({
                accountId: fromAccountId ?? '',
                networkId: buildSwapRes.result.fromTokenInfo.networkId,
                lmTx: buildSwapRes.LMTronObject,
              });
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return {};
            }
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
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return {};
            }
            if (buildSwapRes.btcData) {
              if (
                buildSwapRes.btcData.addressType.includes(
                  fromAddressEncoding ?? '',
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
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return {};
              }
            }
          } else if (isSwapSignedNoSendBuildResult(buildSwapRes)) {
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

          if (!isExecutionRevisionCurrent(operationRevision)) {
            return {};
          }
          assertExecutionSignerUnchanged();
          const { orderId, swapInfo } =
            buildSwapExecutionResultFromBuildResponse({
              buildSwapRes,
              currentFromToken,
              currentToToken,
              fromAccountId,
              fromUserAddress,
              quoteResult: data,
              slippage: slippageItem.value,
              toAccountId,
              toUserAddress,
            });
          setSwapSteps((prev) => ({
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              swapBuildLoading: false,
              toTokenAmount: buildSwapRes.result.toAmount ?? data.toAmount,
              swapBuildResultData: {
                swapInfo,
                orderId,
                skipSendTransAction,
                encodedTx,
                transferInfo,
              },
            },
          }));
          void swapBuildFinish(buildSwapRes, data, operationRevision);
          return {
            swapInfo,
            orderId,
            skipSendTransAction,
            encodedTx,
            transferInfo,
          };
        }
      }
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return {};
      }
      if (!skipLoading) {
        setSwapSteps((prev) => ({
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            swapBuildLoading: false,
          },
        }));
      }
      return {};
    },
    [
      assertExecutionSignerUnchanged,
      slippageItem,
      fromUserAddress,
      toUserAddress,
      fromAccountNetworkId,
      fromAccountId,
      setSwapSteps,
      checkLatestFromTokenBalance,
      checkOtherFee,
      fromWalletType,
      fromAddressEncoding,
      isFirstTimeSwap,
      isModalPage,
      toAccountId,
      swapBuildFinish,
      handleBuildTxSuccessWithSignedNoSend,
      intl,
      isExecutionRevisionCurrent,
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
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
      assertExecutionSignerUnchanged();
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
        } = await buildSwapAction(
          currentFromToken,
          currentToToken,
          data,
          skipLoading,
          operationRevision,
        );
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return;
        }
        if (swapInfo) {
          if (skipSendTransAction) {
            void handleBuildTxSuccessWithSignedNoSend({
              swapInfo,
              orderId,
              operationRevision,
            });
          } else if (shouldFallback) {
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return undefined;
            }
            assertExecutionSignerUnchanged();
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
                  operationRevision,
                ),
              onCancel: () =>
                handleBuildTxFallbackOnCancel(stepIndex, operationRevision),
            });
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return undefined;
            }
            setSwapSteps(
              (prev: {
                steps: ISwapStep[];
                preSwapData: ISwapPreSwapData;
                quoteResult?: IFetchQuoteResult | undefined;
              }) => {
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
              operationRevision,
            );
            if (sendTxRes) {
              void onBuildTxSuccess(
                sendTxRes.txid,
                swapInfo,
                orderId,
                sendTxRes.gasFeeFiatValue,
                sendTxRes.gasFeeInNative,
                operationRevision,
              ).catch(logSwapPostExecutionSideEffectError);
              return sendTxRes;
            }
          }
        }
      }
    },
    [
      assertExecutionSignerUnchanged,
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
      isExecutionRevisionCurrent,
    ],
  );

  const signMessage = useCallback(
    async (
      stepIndex: number,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
      needFetchGas?: boolean,
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
      assertExecutionSignerUnchanged();
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
          if (!isExecutionRevisionCurrent(operationRevision)) {
            return undefined;
          }
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
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return undefined;
              }
              const populated =
                await ethersLib.utils._TypedDataEncoder.resolveNames(
                  unSignedData.domain,
                  unSignedData.types,
                  normalizeData,
                  async (value: string) => value,
                );
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return undefined;
              }
              dataMessage = JSON.stringify(
                ethersLib.utils._TypedDataEncoder.getPayload(
                  populated.domain,
                  unSignedData.types,
                  populated.value,
                ),
              );
            }
            if (dataMessage) {
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return;
              }
              assertExecutionSignerUnchanged();
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
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return;
              }
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
                  operationRevision,
                );
                if (!isExecutionRevisionCurrent(operationRevision)) {
                  return undefined;
                }
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
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return;
              }
              assertExecutionSignerUnchanged();
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
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return;
              }
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
                  operationRevision,
                );
                if (!isExecutionRevisionCurrent(operationRevision)) {
                  return undefined;
                }
                return buildTxRes;
              }
              throw new OneKeyError('sign message failed');
            }
          }
        }
      }
    },
    [
      assertExecutionSignerUnchanged,
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
      isExecutionRevisionCurrent,
    ],
  );

  const wrappedTx = useCallback(
    async (
      stepIndex: number,
      data?: IFetchQuoteResult,
      fromTokenInfo?: ISwapToken,
      toTokenInfo?: ISwapToken,
      needFetchGas?: boolean,
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return undefined;
      }
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
          operationRevision,
        );

        if (sendTxRes) {
          if (isExecutionRevisionCurrent(operationRevision)) {
            void syncRecentTokenPairs({
              swapFromToken: fromTokenInfo,
              swapToToken: toTokenInfo,
            }).catch(logSwapPostExecutionSideEffectError);
          }
          void onBuildTxSuccess(
            sendTxRes.txid,
            swapInfo,
            undefined,
            sendTxRes.gasFeeFiatValue,
            sendTxRes.gasFeeInNative,
            operationRevision,
          ).catch(logSwapPostExecutionSideEffectError);
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
      isExecutionRevisionCurrent,
    ],
  );

  const getApproveUnSignedTxArr = useCallback(
    async (data?: IFetchQuoteResult, operationRevision?: string) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return { unsignedTxArr: [], fallbackApproveInfos: [] };
      }
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
              undefined,
              operationRevision,
            );
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return { unsignedTxArr: [], fallbackApproveInfos: [] };
            }
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
            operationRevision,
          );
          if (!isExecutionRevisionCurrent(operationRevision)) {
            return { unsignedTxArr: [], fallbackApproveInfos: [] };
          }
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
      isExecutionRevisionCurrent,
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
      operationRevision?: string,
    ) => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return;
      }
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
          await getApproveUnSignedTxArr(data, operationRevision);
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return;
        }
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
          operationRevision,
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
      isExecutionRevisionCurrent,
    ],
  );

  const estimateNetworkFee = useCallback(
    async (
      networkId: string,
      accountId: string,
      buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams,
      approveUnsignedTxArr?: IUnsignedTxPro[],
      operationRevision?: string,
    ): Promise<IEstimateNetworkFeeResult> => {
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return {};
      }
      assertExecutionSignerUnchanged();
      if (!fromToken || !fromAccountId || !fromUserAddress) {
        throw new OneKeyError('account error');
      }
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

      if (!isExecutionRevisionCurrent(operationRevision)) {
        return {};
      }

      setSwapSteps((prev) => ({
        ...prev,
        preSwapData: {
          ...prev.preSwapData,
          estimateNetworkFeeLoading: true,
        },
      }));
      try {
        const vaultSettings =
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          });
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return {};
        }
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
          if (!isExecutionRevisionCurrent(operationRevision)) {
            return {};
          }
          try {
            const gasResArr =
              await backgroundApiProxy.serviceGas.batchEstimateFee({
                networkId,
                accountId,
                encodedTxs: estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
              });
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return {};
            }
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.SUCCESS,
              networkId,
              accountId,
              undefined,
              estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
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
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return {};
            }
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.FAIL,
              networkId,
              accountId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              e?.message ?? 'unknown error',
              estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
              swapInfo,
              true,
            );
            if (
              canFallbackToSeparateTxConfirm({
                buildUnsignedParams,
                approveUnsignedTxArr,
              })
            ) {
              setSwapSteps((prev) => ({
                ...prev,
                preSwapData: {
                  ...prev.preSwapData,
                  estimateNetworkFeeLoading: false,
                  netWorkFee: undefined,
                },
              }));
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
              const estimateFeeParams =
                await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                  networkId,
                  accountId,
                  encodedTx: unsignedTxItem.encodedTx,
                });
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return {};
              }
              const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
                ...estimateFeeParams,
                accountAddress: fromUserAddress ?? '',
                networkId,
                accountId,
                scenario: 'swap',
              });
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return {};
              }
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
          if (!isExecutionRevisionCurrent(operationRevision)) {
            return {};
          }
          try {
            const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
              ...estimateFeeParams,
              accountAddress: fromUserAddress ?? '',
              networkId,
              accountId,
              scenario: 'swap',
              gasAccountEnabled: isGasAccountEnabled,
              transfersInfo: unsignedTx.transfersInfo,
              lockedUserNonce:
                typeof unsignedTx.nonce === 'number'
                  ? unsignedTx.nonce
                  : undefined,
            });
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return {};
            }
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.SUCCESS,
              networkId,
              accountId,
              undefined,
              unsignedTx.encodedTx,
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
            if (!isExecutionRevisionCurrent(operationRevision)) {
              return {};
            }
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.FAIL,
              networkId,
              accountId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              e?.message ?? 'unknown error',
              unsignedTx.encodedTx,
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
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return {};
        }
        if (!checkLatestNativeBalanceRes) {
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
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return {};
        }
        const gasFeeFiatValueAll = gasFeeFiatValues.reduce((acc, curr) => {
          return acc.plus(new BigNumber(curr));
        }, new BigNumber(0));
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return {};
        }
        setSwapSteps((prev) => ({
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            netWorkFee: {
              ...prev.preSwapData.netWorkFee,
              gasInfos: [...gasFeeInfos],
              gasFeeFiatValue: !gasFeeFiatValueAll.isZero()
                ? gasFeeFiatValueAll.toFixed()
                : undefined,
            },
            estimateNetworkFeeLoading: false,
          },
        }));
      } catch (_e: any) {
        if (!isExecutionRevisionCurrent(operationRevision)) {
          return {};
        }
        setSwapSteps((prev) => ({
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            estimateNetworkFeeLoading: false,
          },
        }));
        throw _e;
      }
      return {};
    },
    [
      assertExecutionSignerUnchanged,
      buildGasInfo,
      fromToken,
      setSwapSteps,
      swapEstimateFeeEvent,
      fromAccountId,
      fromUserAddress,
      checkLatestNativeTokenBalance,
      isExecutionRevisionCurrent,
    ],
  );

  const preSwapBeforeStepActions = useCallback(
    async (
      data?: IFetchQuoteResult,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
    ) => {
      const currentExecutionSnapshot = executionSnapshotRef.current;
      const executionRevision = currentExecutionSnapshot?.reviewRevision;
      const executionQuote = currentExecutionSnapshot?.quoteResult ?? data;
      const executionFromToken =
        currentExecutionSnapshot?.fromToken ?? currentFromToken;
      const executionToToken =
        currentExecutionSnapshot?.toToken ?? currentToToken;
      if (!isExecutionRevisionCurrent(executionRevision)) {
        return;
      }
      assertExecutionSignerUnchanged();
      if (
        executionQuote?.fromTokenInfo &&
        executionQuote?.toTokenInfo &&
        executionQuote.fromAmount &&
        slippageItem &&
        executionQuote?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        setSwapSteps((prev) => ({
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            stepBeforeActionsLoading: true,
            stepBeforeActionsError: undefined,
          },
        }));
        try {
          const { swapInfo, transferInfo, encodedTx } = await buildSwapAction(
            executionFromToken,
            executionToToken,
            executionQuote,
            undefined,
            executionRevision,
          );
          if (!isExecutionRevisionCurrent(executionRevision)) {
            return;
          }
          const { unsignedTxArr } = await getApproveUnSignedTxArr(
            executionQuote,
            executionRevision,
          );
          if (!isExecutionRevisionCurrent(executionRevision)) {
            return;
          }
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
            executionRevision,
          );
          if (!isExecutionRevisionCurrent(executionRevision)) {
            return;
          }
          if (estimateNetworkFeeResult.fallbackToSeparateTxConfirm) {
            const separateSteps =
              buildSeparateApproveAndSwapSteps(executionQuote);
            if (separateSteps.length) {
              setSwapSteps((prev) => ({
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
              }));
              return;
            }
          }
          setSwapSteps((prev) => ({
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              stepBeforeActionsLoading: false,
              stepBeforeActionsError: undefined,
            },
          }));
        } catch {
          if (!isExecutionRevisionCurrent(executionRevision)) {
            return;
          }
          setSwapSteps((prev) => ({
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              stepBeforeActionsLoading: false,
              stepBeforeActionsError: true,
              netWorkFee: undefined,
            },
          }));
        }
      }
    },
    [
      assertExecutionSignerUnchanged,
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
      isExecutionRevisionCurrent,
    ],
  );

  const preSwapStepsStart = useCallback(
    async (
      swapStepsValues?: {
        steps: ISwapStep[];
        preSwapData: ISwapPreSwapData;
        quoteResult?: IFetchQuoteResult;
      },
      operationRevisionOverride?: string,
    ) => {
      const currentExecutionSnapshot = executionSnapshotRef.current;
      const operationRevision =
        operationRevisionOverride ?? currentExecutionSnapshot?.reviewRevision;
      if (!isExecutionRevisionCurrent(operationRevision)) {
        return;
      }
      assertExecutionSignerUnchanged();
      const swapStepsValuesFinal = swapStepsValues?.steps ?? swapSteps.steps;
      const livePreSwapData =
        swapStepsValues?.preSwapData ?? swapSteps.preSwapData;
      const preSwapDataFinal = currentExecutionSnapshot
        ? {
            ...livePreSwapData,
            swapType: currentExecutionSnapshot.swapType,
            fromToken: currentExecutionSnapshot.fromToken,
            toToken: currentExecutionSnapshot.toToken,
            fromTokenAmount: currentExecutionSnapshot.fromTokenAmount,
            toTokenAmount: currentExecutionSnapshot.toTokenAmount,
            slippage: currentExecutionSnapshot.slippage,
          }
        : livePreSwapData;
      const quoteResultFinal =
        currentExecutionSnapshot?.quoteResult ??
        swapStepsValues?.quoteResult ??
        swapSteps.quoteResult;
      if (swapStepsValuesFinal.length > 0) {
        for (let i = 0; i < swapStepsValuesFinal.length; i += 1) {
          if (!isExecutionRevisionCurrent(operationRevision)) {
            return;
          }
          const stepIndex = i;
          const step = swapStepsValuesFinal[i];
          const { type, isResetApprove, canRetry, status } = step;
          if (
            status === ESwapStepStatus.READY ||
            (canRetry && status === ESwapStepStatus.FAILED)
          ) {
            try {
              setSwapSteps(
                (prevSteps: {
                  steps: ISwapStep[];
                  preSwapData: ISwapPreSwapData;
                }) => {
                  const newSteps = [...prevSteps.steps];
                  newSteps[i] = {
                    ...newSteps[i],
                    status: ESwapStepStatus.LOADING,
                    errorMessage: undefined,
                  };
                  return {
                    ...prevSteps,
                    steps: newSteps,
                  };
                },
              );
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
                    operationRevision,
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
                    operationRevision,
                  );
                }
                if (!isExecutionRevisionCurrent(operationRevision)) {
                  return;
                }
                if (
                  step.shouldWaitApproved ||
                  preSwapDataFinal?.shouldFallback
                ) {
                  setSwapSteps(
                    (prevSteps: {
                      steps: ISwapStep[];
                      preSwapData: ISwapPreSwapData;
                      quoteResult?: IFetchQuoteResult | undefined;
                    }) => {
                      const newSteps = [...prevSteps.steps];
                      newSteps[i] = {
                        ...newSteps[i],
                        status: ESwapStepStatus.PENDING,
                        txHash: approveSendTx?.txid,
                        stepSubTitle: intl.formatMessage({
                          id: ETranslations.swap_btn_approving,
                        }),
                      };
                      return {
                        ...prevSteps,
                        steps: newSteps,
                      };
                    },
                  );
                  if (
                    preSwapDataFinal?.fromToken &&
                    preSwapDataFinal?.toToken
                  ) {
                    setInAppNotificationAtom((pre) => {
                      if (
                        preSwapDataFinal?.fromToken &&
                        preSwapDataFinal?.toToken
                      ) {
                        return {
                          ...pre,
                          swapApprovingTransaction: {
                            txId: approveSendTx?.txid,
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
                            fromToken: preSwapDataFinal?.fromToken,
                            toToken: preSwapDataFinal?.toToken,
                            quoteId: quoteResultFinal?.quoteId ?? '',
                            amount: approveAmount,
                            toAmount: preSwapDataFinal?.toTokenAmount ?? '',
                            useAddress: fromUserAddress ?? '',
                            spenderAddress:
                              preSwapDataFinal?.allowanceResult
                                ?.allowanceTarget ?? '',
                            status: ESwapApproveTransactionStatus.PENDING,
                            kind: quoteResultFinal?.kind ?? ESwapQuoteKind.SELL,
                            resetApproveIsMax: !!swapActionState.approveUnLimit,
                          },
                        };
                      }
                      return pre;
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
                  operationRevision,
                );
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
                  operationRevision,
                );
              } else if (type === ESwapStepType.SIGN_MESSAGE) {
                await signMessage(
                  stepIndex,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  quoteResultFinal,
                  preSwapDataFinal?.needFetchGas,
                  operationRevision,
                );
              } else if (type === ESwapStepType.BATCH_APPROVE_SWAP) {
                await batchApproveSwap(
                  stepIndex,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  quoteResultFinal,
                  preSwapDataFinal?.shouldFallback,
                  preSwapDataFinal?.needFetchGas,
                  operationRevision,
                );
              }

              if (!isExecutionRevisionCurrent(operationRevision)) {
                return;
              }

              if (
                i !== swapStepsValuesFinal.length - 1 &&
                !preSwapDataFinal?.shouldFallback
              ) {
                setSwapSteps(
                  (prevSteps: {
                    steps: ISwapStep[];
                    preSwapData: ISwapPreSwapData;
                    quoteResult?: IFetchQuoteResult | undefined;
                  }) => {
                    const newSteps = [...prevSteps.steps];
                    newSteps[i] = {
                      ...newSteps[i],
                      status: ESwapStepStatus.SUCCESS,
                    };
                    return {
                      ...prevSteps,
                      steps: newSteps,
                    };
                  },
                );
              }
            } catch (error: any) {
              if (!isExecutionRevisionCurrent(operationRevision)) {
                return;
              }
              const shouldFallback =
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.name !== EOneKeyErrorClassNames.OneKeyAppError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.name !== EOneKeyErrorClassNames.OneKeyHardwareError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.className !==
                  EOneKeyErrorClassNames.OneKeyHardwareError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.className !== EOneKeyErrorClassNames.OneKeyLocalError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                !error?.$isHardwareError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.key !== 'global.cancel' &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.code !== 803 &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.code !== -99_999 &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                !String(error?.message ?? '')
                  .toLowerCase()
                  .includes('reject') &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                step.type !== ESwapStepType.SIGN_MESSAGE &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.name !== 'buildSwapApi';
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              let errorMessage = error?.message ?? 'Unknown error';
              if (shouldFallback) {
                errorMessage = undefined;
              }
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              if (error?.key === 'global.cancel') {
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
                const newSteps = [...fallbackSwapStepsValues.steps];
                newSteps[i] = {
                  ...newSteps[i],
                  status: ESwapStepStatus.READY,
                };
                fallbackSwapStepsValues = {
                  steps: [...newSteps],
                  preSwapData: {
                    ...fallbackSwapStepsValues.preSwapData,
                    shouldFallback,
                  },
                  quoteResult: fallbackSwapStepsValues.quoteResult,
                };
              }
              setSwapSteps(
                (prevSteps: {
                  steps: ISwapStep[];
                  preSwapData: ISwapPreSwapData;
                  quoteResult?: IFetchQuoteResult | undefined;
                }) => {
                  const newSteps = [...prevSteps.steps];
                  newSteps[i] = {
                    ...newSteps[i],
                    status: shouldFallback
                      ? ESwapStepStatus.READY
                      : ESwapStepStatus.FAILED,
                    errorMessage,
                  };
                  return {
                    ...prevSteps,
                    steps: newSteps,
                    preSwapData: {
                      ...prevSteps.preSwapData,
                      shouldFallback,
                    },
                  };
                },
              );
              if (
                shouldFallback &&
                !swapStepsValues?.preSwapData.shouldFallback
              ) {
                void preSwapStepsStart(
                  fallbackSwapStepsValues,
                  operationRevision,
                );
              } else if (
                accountUtils.isQrAccount({
                  accountId: fromAccountId ?? '',
                }) &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.key !== 'global.cancel'
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
      assertExecutionSignerUnchanged,
      goBackQrCodeModal,
      swapSteps.steps,
      swapSteps.preSwapData,
      swapSteps.quoteResult,
      setSwapSteps,
      approveTxNew,
      swapActionState.approveUnLimit,
      intl,
      setInAppNotificationAtom,
      fromUserAddress,
      fromAccountId,
      wrappedTx,
      buildTxNew,
      signMessage,
      batchApproveSwap,
      isExecutionRevisionCurrent,
    ],
  );

  return { preSwapStepsStart, cancelLimitOrder, preSwapBeforeStepActions };
}
