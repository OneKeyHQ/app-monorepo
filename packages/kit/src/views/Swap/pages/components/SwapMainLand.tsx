import { useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type {
  IDialogInstance,
  IKeyOfIcons,
  IPageNavigationProp,
} from '@onekeyhq/components';
import {
  Button,
  Dialog,
  EPageType,
  ScrollView,
  YStack,
  useInModalDialog,
  useInTabDialog,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapActions,
  useSwapAlertsAtom,
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteIntervalCountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import {
  EJotaiContextStoreNames,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IFetchQuoteResult,
  ISwapInitParams,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapSelectTokenSource,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
  LIMIT_PRICE_DEFAULT_DECIMALS,
  SwapBuildShouldFallBackNetworkIds,
  SwapBuildUseMultiplePopoversNetworkIds,
} from '@onekeyhq/shared/types/swap/types';

import SwapRecentTokenPairsGroup from '../../components/SwapRecentTokenPairsGroup';
import TransactionLossNetworkFeeExceedDialog from '../../components/TransactionLossNetworkFeeExceedDialog';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';
import { useSwapInit } from '../../hooks/useSwapGlobal';
import {
  ESwapBatchTransferType,
  useSwapBatchTransferType,
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
  useSwapSlippagePercentageModeInfo,
} from '../../hooks/useSwapState';
import { SwapProviderMirror } from '../SwapProviderMirror';

import LimitInfoContainer from './LimitInfoContainer';
import LimitOrderOpenItem from './LimitOrderOpenItem';
import PreSwapDialogContent from './PreSwapDialogContent';
import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapHeaderContainer from './SwapHeaderContainer';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';
import SwapTipsContainer from './SwapTipsContainer';

interface ISwapMainLoadProps {
  children?: React.ReactNode;
  swapInitParams?: ISwapInitParams;
  pageType?: EPageType.modal;
}

const SwapMainLoad = ({ swapInitParams, pageType }: ISwapMainLoadProps) => {
  const { preSwapStepsStart } = useSwapBuildTx();
  const intl = useIntl();
  const { fetchLoading } = useSwapInit(swapInitParams);
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const [alerts] = useSwapAlertsAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const toAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const quoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [{ swapRecentTokenPairs }] = useInAppNotificationAtom();
  const [fromTokenAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapQuoteIntervalCount] = useSwapQuoteIntervalCountAtom();
  const { selectFromToken, selectToToken, quoteAction, cleanQuoteInterval } =
    useSwapActions().current;
  const [{ actionLock }] = useSwapQuoteActionLockAtom();
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [, setSwapShouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [fromSelectToken] = useSwapSelectFromTokenAtom();
  const [toSelectToken] = useSwapSelectToTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [currentQuoteRes] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapSteps] = useSwapStepsAtom();
  const [swapToAmount] = useSwapToTokenAmountAtom();
  const [swapLimitUseRate] = useSwapLimitPriceUseRateAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const [swapStepData] = useSwapStepsAtom();
  const swapSlippageRef = useRef(slippageItem);
  if (swapSlippageRef.current !== slippageItem) {
    swapSlippageRef.current = slippageItem;
  }
  const dialogRef = useRef<IDialogInstance>(null);
  const InTabDialog = useInTabDialog();
  const InModalDialog = useInModalDialog();
  const storeName = useMemo(
    () =>
      pageType === EPageType.modal
        ? EJotaiContextStoreNames.swapModal
        : EJotaiContextStoreNames.swap,
    [pageType],
  );

  const swapStepsRef = useRef<ISwapStep[]>([]);
  if (
    swapStepsRef.current !== swapStepData.steps ||
    swapStepsRef.current.length !== swapStepData.steps.length
  ) {
    swapStepsRef.current = [...swapStepData.steps];
  }

  const quoteResultRef = useRef<IFetchQuoteResult | undefined>(undefined);
  if (quoteResultRef.current !== currentQuoteRes) {
    quoteResultRef.current = currentQuoteRes;
  }

  const preSwapDataRef = useRef<ISwapPreSwapData | undefined>(undefined);
  if (preSwapDataRef.current !== swapStepData.preSwapData) {
    preSwapDataRef.current = swapStepData.preSwapData;
  }

  const onSelectToken = useCallback(
    (type: ESwapDirectionType) => {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapTokenSelect,
        params: {
          type,
          storeName,
        },
      });
    },
    [navigation, storeName],
  );
  const onSelectRecentTokenPairs = useCallback(
    ({
      fromToken: fromTokenPair,
      toToken: toTokenPair,
    }: {
      fromToken: ISwapToken;
      toToken: ISwapToken;
    }) => {
      const skipCheckEqualToken = !equalTokenNoCaseSensitive({
        token1: fromTokenPair,
        token2: toTokenPair,
      });
      void selectFromToken(fromTokenPair, true, undefined, skipCheckEqualToken);
      void selectToToken(toTokenPair, undefined, skipCheckEqualToken);
      defaultLogger.swap.selectToken.selectToken({
        selectFrom: ESwapSelectTokenSource.RECENT_SELECT,
      });
    },
    [selectFromToken, selectToToken],
  );
  const onOpenProviderList = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProviderSelect,
      params: {
        storeName,
      },
    });
  }, [navigation, storeName]);

  const onToAnotherAddressModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapToAnotherAddress,
      params: {
        address: toAddressInfo.address,
        storeName,
      },
    });
  }, [navigation, storeName, toAddressInfo.address]);

  const refreshAction = useCallback(
    (manual?: boolean) => {
      if (manual) {
        void quoteAction(
          swapSlippageRef.current,
          swapFromAddressInfo?.address,
          swapFromAddressInfo?.accountInfo?.account?.id,
          undefined,
          undefined,
          quoteResult?.kind ?? ESwapQuoteKind.SELL,
          undefined,
          toAddressInfo?.address,
        );
      } else {
        if (actionLock) {
          return;
        }
        setSwapQuoteIntervalCount((v) => v + 1);
        void quoteAction(
          swapSlippageRef.current,
          swapFromAddressInfo?.address,
          swapFromAddressInfo?.accountInfo?.account?.id,
          undefined,
          true,
          quoteResult?.kind ?? ESwapQuoteKind.SELL,
          undefined,
          toAddressInfo?.address,
        );
      }
    },
    [
      actionLock,
      quoteAction,
      swapFromAddressInfo?.address,
      swapFromAddressInfo?.accountInfo?.account?.id,
      quoteResult?.kind,
      setSwapQuoteIntervalCount,
      toAddressInfo?.address,
    ],
  );

  const onSelectPercentageStage = useCallback(
    (stage: number) => {
      const fromTokenBalanceBN = new BigNumber(fromTokenBalance ?? 0);
      const amountBN = fromTokenBalanceBN.multipliedBy(stage / 100);
      const amountAfterDecimal = amountBN.decimalPlaces(
        fromSelectToken?.decimals ?? 6,
        BigNumber.ROUND_DOWN,
      );
      if (
        !amountAfterDecimal.isNaN() &&
        validateAmountInput(
          amountAfterDecimal.toFixed(),
          fromSelectToken?.decimals,
        )
      ) {
        setFromInputAmount({
          value: amountAfterDecimal.toFixed(),
          isInput: true,
        });
      }
    },
    [fromTokenBalance, fromSelectToken?.decimals, setFromInputAmount],
  );

  const isWrapped = useMemo(
    () =>
      checkWrappedTokenPair({
        fromToken: fromSelectToken,
        toToken: toSelectToken,
      }),
    [fromSelectToken, toSelectToken],
  );
  const swapBatchTransferType = useSwapBatchTransferType(
    swapFromAddressInfo.networkId,
    swapFromAddressInfo.accountInfo?.account?.id,
    currentQuoteRes?.providerDisableBatchTransfer,
    Boolean(currentQuoteRes?.swapShouldSignedData),
    Boolean(currentQuoteRes?.allowanceResult),
  );

  const supportPreBuild = useMemo(() => {
    if (isWrapped) {
      return false;
    }
    if (currentQuoteRes && !currentQuoteRes?.allowanceResult) {
      return true;
    }
    return (
      !currentQuoteRes?.providerDisableBatchTransfer &&
      !SwapBuildUseMultiplePopoversNetworkIds.includes(
        fromSelectToken?.networkId ?? '',
      )
    );
  }, [currentQuoteRes, fromSelectToken?.networkId, isWrapped]);

  const createWrapStep = useCallback(
    (quoteRes: IFetchQuoteResult) => {
      return {
        type: ESwapStepType.WRAP_TX,
        status: ESwapStepStatus.READY,
        data: quoteRes,
        fromToken: fromSelectToken,
        toToken: toSelectToken,
        stepTitle: intl.formatMessage({
          id: ETranslations.swap_page_button_wrap,
        }),
        stepActionsLabel: intl.formatMessage({
          id: ETranslations.swap_page_button_wrap,
        }),
      };
    },
    [fromSelectToken, intl, toSelectToken],
  );

  const createApproveStep = useCallback(
    (isResetApprove: boolean, stepActionsLabel: string, stepTitle: string) => {
      return {
        type: ESwapStepType.APPROVE_TX,
        status: ESwapStepStatus.READY,
        isResetApprove,
        canRetry: true,
        stepActionsLabel,
        stepTitle,
        shouldWaitApproved: true,
      };
    },
    [],
  );

  const createSignStep = useCallback(() => {
    return {
      type: ESwapStepType.SIGN_MESSAGE,
      status: ESwapStepStatus.READY,
      stepTitle: intl.formatMessage({
        id: ETranslations.swap_review_sign_and_submit,
      }),
      stepActionsLabel: intl.formatMessage({
        id: ETranslations.global_sign,
      }),
    };
  }, [intl]);

  const createBatchApproveSwapStep = useCallback(() => {
    return {
      type: ESwapStepType.BATCH_APPROVE_SWAP,
      status: ESwapStepStatus.READY,
      stepTitle:
        swapBatchTransferType ===
        ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP
          ? `${intl.formatMessage({
              id: ETranslations.swap_page_approve_and_swap,
            })} [ 0 / ${
              currentQuoteRes?.allowanceResult?.shouldResetApprove ? 3 : 2
            } ]`
          : intl.formatMessage({
              id: ETranslations.swap_page_approve_and_swap,
            }),
      stepActionsLabel: intl.formatMessage({
        id: ETranslations.swap_page_approve_and_swap,
      }),
    };
  }, [
    swapBatchTransferType,
    intl,
    currentQuoteRes?.allowanceResult?.shouldResetApprove,
  ]);

  const shouldSignEveryTime = useMemo(() => {
    const isExternalAccount = accountUtils.isExternalAccount({
      accountId: swapFromAddressInfo.accountInfo?.account?.id ?? '',
    });
    const isHDAccount = accountUtils.isHwOrQrAccount({
      accountId: swapFromAddressInfo.accountInfo?.account?.id ?? '',
    });
    const isShouldApprove = Boolean(currentQuoteRes?.allowanceResult);
    return (isExternalAccount || isHDAccount) && isShouldApprove;
  }, [
    currentQuoteRes?.allowanceResult,
    swapFromAddressInfo.accountInfo?.account?.id,
  ]);

  const createSendTxStep = useCallback(() => {
    return {
      type: ESwapStepType.SEND_TX,
      status: ESwapStepStatus.READY,
      stepTitle: intl.formatMessage({
        id: ETranslations.swap_review_confirm_swap,
      }),
      stepActionsLabel: intl.formatMessage({
        id: ETranslations.global_swap,
      }),
    };
  }, [intl]);

  const needFetchGas = useMemo(() => {
    if (
      currentQuoteRes?.allowanceResult &&
      !(
        swapBatchTransferType ===
          ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP ||
        swapBatchTransferType ===
          ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP
      )
    ) {
      return true;
    }
    return false;
  }, [currentQuoteRes?.allowanceResult, swapBatchTransferType]);

  const parseQuoteResultToSteps = useCallback(() => {
    let steps: ISwapStep[] = [];
    if (currentQuoteRes?.isWrapped) {
      steps = [createWrapStep(currentQuoteRes)];
    } else if (currentQuoteRes?.swapShouldSignedData) {
      if (currentQuoteRes?.allowanceResult) {
        if (currentQuoteRes?.allowanceResult.shouldResetApprove) {
          steps = [
            createApproveStep(
              true,
              intl.formatMessage({
                id: ETranslations.swap_page_approve_and_sign,
              }),
              intl.formatMessage(
                {
                  id: ETranslations.global_revoke_approve,
                },
                {
                  symbol: fromSelectToken?.symbol,
                },
              ),
            ),
          ];
        }
        steps = [
          ...steps,
          createApproveStep(
            false,
            intl.formatMessage({
              id: ETranslations.swap_page_approve_and_sign,
            }),
            intl.formatMessage(
              {
                id: ETranslations.swap_page_approve_button,
              },
              {
                token: fromSelectToken?.symbol,
              },
            ),
          ),
        ];
      }
      steps = [...steps, createSignStep()];
    } else if (
      (swapBatchTransferType ===
        ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP ||
        swapBatchTransferType ===
          ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP) &&
      currentQuoteRes?.allowanceResult
    ) {
      steps = [createBatchApproveSwapStep()];
    } else {
      if (currentQuoteRes?.allowanceResult) {
        if (currentQuoteRes?.allowanceResult.shouldResetApprove) {
          steps = [
            createApproveStep(
              true,
              intl.formatMessage({
                id: ETranslations.swap_page_approve_and_swap,
              }),
              intl.formatMessage(
                {
                  id: ETranslations.global_revoke_approve,
                },
                {
                  symbol: fromSelectToken?.symbol,
                },
              ),
            ),
          ];
        }
        steps = [
          ...steps,
          createApproveStep(
            false,
            intl.formatMessage({
              id: ETranslations.swap_page_approve_and_swap,
            }),
            intl.formatMessage(
              {
                id: ETranslations.swap_page_approve_button,
              },
              {
                token: fromSelectToken?.symbol,
                target: currentQuoteRes?.info.providerName,
              },
            ),
          ),
        ];
      }
      steps = [...steps, createSendTxStep()];
    }
    setSwapSteps({
      steps: [...steps],
      preSwapData: {
        swapType: swapTypeSwitch,
        fromToken: fromSelectToken,
        toToken: toSelectToken,
        shouldFallback: SwapBuildShouldFallBackNetworkIds.includes(
          fromSelectToken?.networkId ?? '',
        ),
        fromTokenAmount: fromAmount.value,
        toTokenAmount: swapToAmount.value,
        providerInfo: currentQuoteRes?.info,
        supportPreBuild,
        needFetchGas,
        minToAmount: currentQuoteRes?.minToAmount,
        slippage:
          currentQuoteRes?.protocol === EProtocolOfExchange.LIMIT ||
          currentQuoteRes?.unSupportSlippage
            ? undefined
            : swapSlippageRef.current.value,
        unSupportSlippage: currentQuoteRes?.unSupportSlippage ?? false,
        isHWAndExBatchTransfer: shouldSignEveryTime,
        fee: currentQuoteRes?.fee,
        ...(!(
          steps.length > 0 &&
          steps[steps.length - 1].type === ESwapStepType.SIGN_MESSAGE
        )
          ? {
              supportNetworkFeeLevel: true,
            }
          : {}),
      },
      quoteResult: { ...(currentQuoteRes as IFetchQuoteResult) },
    });
  }, [
    shouldSignEveryTime,
    currentQuoteRes,
    swapBatchTransferType,
    setSwapSteps,
    swapTypeSwitch,
    fromSelectToken,
    toSelectToken,
    fromAmount.value,
    swapToAmount.value,
    supportPreBuild,
    needFetchGas,
    createWrapStep,
    createSignStep,
    createApproveStep,
    intl,
    createBatchApproveSwapStep,
    createSendTxStep,
  ]);
  const onActionHandler = useCallback(() => {
    if (
      swapStepsRef.current.length > 0 &&
      preSwapDataRef.current &&
      quoteResultRef.current
    ) {
      void preSwapStepsStart({
        steps: swapStepsRef.current,
        preSwapData: preSwapDataRef.current,
        quoteResult: quoteResultRef.current,
      });
    }
  }, [preSwapStepsStart]);

  const onActionHandlerBefore = useCallback(() => {
    if (currentQuoteRes?.quoteShowTip) {
      Dialog.confirm({
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          onActionHandler();
        },
        title: currentQuoteRes?.quoteShowTip.title ?? '',
        description: currentQuoteRes.quoteShowTip.detail ?? '',
        icon:
          (currentQuoteRes?.quoteShowTip.icon as IKeyOfIcons) ??
          'ChecklistBoxOutline',
        renderContent: currentQuoteRes.quoteShowTip?.link ? (
          <Button
            variant="tertiary"
            size="small"
            alignSelf="flex-start"
            icon="QuestionmarkOutline"
            onPress={() => {
              if (currentQuoteRes.quoteShowTip?.link) {
                openUrlExternal(currentQuoteRes.quoteShowTip?.link);
              }
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </Button>
        ) : undefined,
      });
    } else if (
      currentQuoteRes?.networkCostExceedInfo &&
      !currentQuoteRes.allowanceResult
    ) {
      let percentage = currentQuoteRes.networkCostExceedInfo?.exceedPercent;
      const netCost = new BigNumber(
        currentQuoteRes.networkCostExceedInfo?.cost ?? '0',
      );
      if (
        currentQuoteRes.protocol === EProtocolOfExchange.LIMIT &&
        netCost.gt(0)
      ) {
        let toRealAmount = new BigNumber(0);
        const fromAmountBN = new BigNumber(fromAmount.value);
        const toAmountBN = new BigNumber(swapToAmount.value);
        if (!toAmountBN.isNaN() && !toAmountBN.isZero()) {
          toRealAmount = new BigNumber(swapToAmount.value);
        } else if (
          !fromAmountBN.isNaN() &&
          !fromAmountBN.isZero() &&
          swapLimitUseRate.rate
        ) {
          const cToAmountBN = new BigNumber(fromAmountBN).multipliedBy(
            new BigNumber(swapLimitUseRate.rate),
          );
          toRealAmount = cToAmountBN.decimalPlaces(
            toToken?.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS,
            BigNumber.ROUND_HALF_UP,
          );
        }
        const calculateNetworkCostExceedPercent =
          netCost.dividedBy(toRealAmount);
        if (calculateNetworkCostExceedPercent.lte(new BigNumber(0.1))) {
          onActionHandler();
          return;
        }
        percentage = calculateNetworkCostExceedPercent
          .multipliedBy(100)
          .toFixed(2);
      }
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslations.swap_network_cost_dialog_title,
        }),
        description: intl.formatMessage(
          {
            id: ETranslations.swap_network_cost_dialog_description,
          },
          {
            number: ` ${percentage}%`,
          },
        ),
        renderContent: (
          <TransactionLossNetworkFeeExceedDialog
            protocol={currentQuoteRes.protocol ?? EProtocolOfExchange.SWAP}
            networkCostExceedInfo={{
              ...currentQuoteRes.networkCostExceedInfo,
              exceedPercent: percentage,
            }}
          />
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          onActionHandler();
        },
      });
    } else {
      onActionHandler();
    }
  }, [
    currentQuoteRes?.allowanceResult,
    currentQuoteRes?.networkCostExceedInfo,
    currentQuoteRes?.protocol,
    currentQuoteRes?.quoteShowTip,
    intl,
    onActionHandler,
    swapLimitUseRate.rate,
    fromAmount.value,
    swapToAmount.value,
    toToken?.decimals,
  ]);

  const handleConfirm = useCallback(async () => {
    onActionHandlerBefore();
  }, [onActionHandlerBefore]);

  const dialogClose = useCallback(() => {
    void dialogRef.current?.close();
  }, []);

  const onPreSwapClose = useCallback(() => {
    dialogClose();
    setSwapBuildTxFetching(false);
    void backgroundApiProxy.serviceGas.abortEstimateFee();
    setTimeout(() => {
      setSwapSteps({
        steps: [],
        preSwapData: {},
      });
    }, 500);
  }, [setSwapBuildTxFetching, dialogClose, setSwapSteps]);

  const onPreSwap = useCallback(() => {
    if (!currentQuoteRes) {
      return;
    }
    cleanQuoteInterval();
    setSwapShouldRefreshQuote(true);
    parseQuoteResultToSteps();
    setSwapBuildTxFetching(true);
    setTimeout(() => {
      dialogRef.current =
        pageType === EPageType.modal
          ? InModalDialog.show({
              onClose: onPreSwapClose,
              title: intl.formatMessage({
                id: ETranslations.global_review_order,
              }),
              showFooter: false,
              renderContent: (
                <AccountSelectorProviderMirror
                  config={{
                    sceneName: EAccountSelectorSceneName.swap,
                    sceneUrl: '',
                  }}
                  enabledNum={[0, 1]}
                >
                  <SwapProviderMirror
                    storeName={
                      pageType === EPageType.modal
                        ? EJotaiContextStoreNames.swapModal
                        : EJotaiContextStoreNames.swap
                    }
                  >
                    <PreSwapDialogContent
                      onConfirm={handleConfirm}
                      onDone={onPreSwapClose}
                    />
                  </SwapProviderMirror>
                </AccountSelectorProviderMirror>
              ),
              showCancelButton: false,
              showConfirmButton: false,
            })
          : InTabDialog.show({
              onClose: onPreSwapClose,
              title: intl.formatMessage({
                id: ETranslations.global_review_order,
              }),
              showFooter: false,
              renderContent: (
                <AccountSelectorProviderMirror
                  config={{
                    sceneName: EAccountSelectorSceneName.swap,
                    sceneUrl: '',
                  }}
                  enabledNum={[0, 1]}
                >
                  <SwapProviderMirror
                    storeName={
                      pageType === EPageType.modal
                        ? EJotaiContextStoreNames.swapModal
                        : EJotaiContextStoreNames.swap
                    }
                  >
                    <PreSwapDialogContent
                      onDone={onPreSwapClose}
                      onConfirm={handleConfirm}
                    />
                  </SwapProviderMirror>
                </AccountSelectorProviderMirror>
              ),
              showCancelButton: false,
              showConfirmButton: false,
            });
    }, 100);
  }, [
    InTabDialog,
    InModalDialog,
    currentQuoteRes,
    cleanQuoteInterval,
    setSwapShouldRefreshQuote,
    parseQuoteResultToSteps,
    onPreSwapClose,
    intl,
    pageType,
    handleConfirm,
    setSwapBuildTxFetching,
  ]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <YStack
        testID="swap-content-container"
        flex={1}
        marginHorizontal="auto"
        width="100%"
        maxWidth={pageType === EPageType.modal ? '100%' : 500}
      >
        <YStack
          pt="$2.5"
          px="$5"
          pb="$5"
          gap="$5"
          flex={1}
          $gtMd={{
            flex: 'unset',
            pt: pageType === EPageType.modal ? '$2.5' : '$5',
          }}
        >
          <SwapTipsContainer />
          <SwapHeaderContainer
            pageType={pageType}
            defaultSwapType={swapInitParams?.swapTabSwitchType}
          />
          <LimitOrderOpenItem storeName={storeName} />
          <SwapQuoteInput
            onSelectToken={onSelectToken}
            selectLoading={fetchLoading}
            onSelectPercentageStage={onSelectPercentageStage}
          />
          {swapTypeSwitch === ESwapTabSwitchType.LIMIT && !isWrapped ? (
            <LimitInfoContainer />
          ) : null}
          <SwapActionsState
            onPreSwap={onPreSwap}
            onOpenRecipientAddress={onToAnotherAddressModal}
            onSelectPercentageStage={onSelectPercentageStage}
          />
          <SwapQuoteResult
            refreshAction={refreshAction}
            onOpenProviderList={onOpenProviderList}
            quoteResult={quoteResult}
            onOpenRecipient={onToAnotherAddressModal}
          />
          {alerts.states.length > 0 &&
          !quoteLoading &&
          !quoteEventFetching &&
          alerts?.quoteId === (quoteResult?.quoteId ?? '') ? (
            <SwapAlertContainer alerts={alerts.states} />
          ) : null}
          <SwapRecentTokenPairsGroup
            onSelectTokenPairs={onSelectRecentTokenPairs}
            tokenPairs={swapRecentTokenPairs}
            fromTokenAmount={fromTokenAmount.value}
          />
        </YStack>
      </YStack>
    </ScrollView>
  );
};

const SwapMainLandWithPageType = (props: ISwapMainLoadProps) => (
  <SwapProviderMirror
    storeName={
      props?.pageType === EPageType.modal
        ? EJotaiContextStoreNames.swapModal
        : EJotaiContextStoreNames.swap
    }
  >
    <SwapMainLoad {...props} pageType={props?.pageType} />
  </SwapProviderMirror>
);

export default SwapMainLandWithPageType;
