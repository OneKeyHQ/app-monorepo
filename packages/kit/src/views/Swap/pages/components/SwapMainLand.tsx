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
  Toast,
  YStack,
  useInModalDialog,
  useInTabDialog,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { LazyPageContainer } from '@onekeyhq/kit/src/components/LazyPageContainer';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCustomRpcAvailability } from '@onekeyhq/kit/src/hooks/useCustomRpcAvailability';
import {
  useSwapActions,
  useSwapAlertsAtom,
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapNativeTokenReserveGasAtom,
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteIntervalCountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapSpeedQuoteResultAtom,
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import {
  EJotaiContextStoreNames,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  ISwapInitParams,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapProTradeType,
  ESwapQuoteKind,
  ESwapSelectTokenSource,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
  LIMIT_PRICE_DEFAULT_DECIMALS,
  SwapBuildShouldFallBackNetworkIds,
  SwapBuildUseMultiplePopoversNetworkIds,
} from '@onekeyhq/shared/types/swap/types';

import TransactionLossNetworkFeeExceedDialog from '../../components/TransactionLossNetworkFeeExceedDialog';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MarketWatchListProviderMirrorV2 } from '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';
import { useSwapInit } from '../../hooks/useSwapGlobal';
import {
  useSwapProAccount,
  useSwapProErrorAlert,
  useSwapProInit,
  useSwapProInputToken,
  useSwapProToToken,
  useSwapProTokenInit,
} from '../../hooks/useSwapPro';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import {
  ESwapBatchTransferType,
  useSwapBatchTransferType,
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
  useSwapSlippagePercentageModeInfo,
} from '../../hooks/useSwapState';
import { SwapProviderMirror } from '../SwapProviderMirror';

import PreSwapDialogContent from './PreSwapDialogContent';
import SwapBridgeMdContainer from './SwapBridgeMdContainer';
import SwapHeaderContainer from './SwapHeaderContainer';
import SwapOldSwapBridgeLimitContainer from './SwapOldSwapBridgeLimitContainer';
import SwapProContainer from './SwapProContainer';
import SwapSwapMbContainer from './SwapSwapMbContainer';
import SwapTipsContainer from './SwapTipsContainer';

import type { ScrollView as ScrollViewNative } from 'react-native';

interface ISwapMainLoadProps {
  children?: React.ReactNode;
  swapInitParams?: ISwapInitParams;
  pageType?: EPageType.modal;
}

const SwapMainLoad = ({ swapInitParams, pageType }: ISwapMainLoadProps) => {
  const { preSwapStepsStart, preSwapBeforeStepActions } = useSwapBuildTx();
  const intl = useIntl();
  const { fetchLoading } = useSwapInit(swapInitParams);
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const [alerts] = useSwapAlertsAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const toAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  // Check custom RPC availability for the from network
  const { isCustomRpcUnavailable } = useCustomRpcAvailability(
    swapFromAddressInfo.networkId,
  );
  const quoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [{ swapRecentTokenPairs }] = useInAppNotificationAtom();
  const [fromTokenAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapQuoteIntervalCount] = useSwapQuoteIntervalCountAtom();
  const { selectFromToken, selectToToken, quoteAction, cleanQuoteInterval } =
    useSwapActions().current;
  const [{ actionLock }] = useSwapQuoteActionLockAtom();
  const [swapFromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [, setSwapShouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [fromSelectTokenAtom] = useSwapSelectFromTokenAtom();
  const [toSelectTokenAtom, setSwapSelectToToken] = useSwapSelectToTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [currentQuote] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapSteps] = useSwapStepsAtom();
  const [swapToAmount] = useSwapToTokenAmountAtom();
  const [swapLimitUseRate] = useSwapLimitPriceUseRateAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapStepData] = useSwapStepsAtom();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const [swapProSelectToken, setSwapProSelectToken] =
    useSwapProSelectTokenAtom();
  const swapProFromToken = useSwapProInputToken();
  const swapProToToken = useSwapProToToken();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const swapProAccount = useSwapProAccount();
  const tokenDetailActions = useTokenDetailActions();

  const swapFromTokenRef = useRef<ISwapToken | undefined>(undefined);
  if (swapFromTokenRef.current !== fromSelectTokenAtom) {
    swapFromTokenRef.current = fromSelectTokenAtom;
  }
  const swapToTokenRef = useRef<ISwapToken | undefined>(undefined);
  if (swapToTokenRef.current !== toSelectTokenAtom) {
    swapToTokenRef.current = toSelectTokenAtom;
  }

  const focusSwapPro = useMemo(() => {
    return platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  }, [swapTypeSwitch]);
  const currentQuoteRes = useMemo(() => {
    if (focusSwapPro && swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProQuoteResult;
    }
    return currentQuote;
  }, [focusSwapPro, swapProTradeType, currentQuote, swapProQuoteResult]);
  const fromSelectToken = useMemo(() => {
    if (focusSwapPro) {
      return swapProFromToken;
    }
    return fromSelectTokenAtom;
  }, [focusSwapPro, fromSelectTokenAtom, swapProFromToken]);
  const toSelectToken = useMemo(() => {
    if (focusSwapPro) {
      return swapProToToken;
    }
    return toSelectTokenAtom;
  }, [focusSwapPro, toSelectTokenAtom, swapProToToken]);

  const swapTypeFinal = useMemo(() => {
    if (focusSwapPro) {
      return swapProTradeType === ESwapProTradeType.LIMIT
        ? ESwapTabSwitchType.LIMIT
        : ESwapTabSwitchType.SWAP;
    }
    return swapTypeSwitch;
  }, [focusSwapPro, swapProTradeType, swapTypeSwitch]);
  const fromTokenBalance = useMemo(() => {
    if (focusSwapPro) {
      return swapProFromToken?.balanceParsed;
    }
    return swapFromTokenBalance;
  }, [focusSwapPro, swapFromTokenBalance, swapProFromToken?.balanceParsed]);
  const [swapNativeTokenReserveGas] = useSwapNativeTokenReserveGasAtom();
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
    (type: ESwapDirectionType, autoSearch?: boolean) => {
      dismissKeyboard();
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapTokenSelect,
        params: {
          type,
          storeName,
          autoSearch,
        },
      });
    },
    [navigation, storeName],
  );

  const onProSelectToken = useCallback(
    (autoSearch?: boolean) => {
      dismissKeyboard();
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapProSelectToken,
        params: {
          storeName,
          autoSearch,
        },
      });
    },
    [navigation, storeName],
  );

  const onProMarketDetail = useCallback(() => {
    dismissKeyboard();
    // Clear token detail before navigation to avoid stale data
    tokenDetailActions.current.clearTokenDetail();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProMarketDetail,
      params: {
        tokenAddress: swapProSelectToken?.contractAddress ?? '',
        network: swapProSelectToken?.networkId ?? '',
        isNative: swapProSelectToken?.isNative,
        from: EEnterWay.SwapPro,
        disableTrade: true,
      },
    });
  }, [
    navigation,
    tokenDetailActions,
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    swapProSelectToken?.isNative,
  ]);

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
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProviderSelect,
      params: {
        storeName,
      },
    });
  }, [navigation, storeName]);

  const onToAnotherAddressModal = useCallback(() => {
    dismissKeyboard();
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

  const reserveGasFormatter: INumberFormatProps = useMemo(() => {
    return {
      formatter: 'balance',
      formatterOptions: {
        tokenSymbol: fromSelectToken?.symbol,
      },
    };
  }, [fromSelectToken?.symbol]);

  const checkNativeTokenGasToast = useCallback(() => {
    let maxAmount = new BigNumber(fromTokenBalance ?? 0);
    if (fromSelectToken?.isNative) {
      const reserveGas = swapNativeTokenReserveGas.find(
        (item) => item.networkId === fromSelectToken.networkId,
      )?.reserveGas;
      if (reserveGas) {
        maxAmount = BigNumber.max(
          0,
          maxAmount.minus(new BigNumber(reserveGas)),
        ).decimalPlaces(fromSelectToken?.decimals ?? 6, BigNumber.ROUND_DOWN);
      }
      let reserveGasFormatted: string | undefined | number = reserveGas;
      if (reserveGas) {
        reserveGasFormatted = numberFormat(
          reserveGas.toString(),
          reserveGasFormatter,
        );
      }
      const message = intl.formatMessage(
        {
          id: reserveGasFormatted
            ? ETranslations.swap_native_token_max_tip_already
            : ETranslations.swap_native_token_max_tip,
        },
        {
          num_token: reserveGasFormatted,
        },
      );
      Toast.message({
        title: message,
      });
    }
    return maxAmount;
  }, [
    fromTokenBalance,
    fromSelectToken?.isNative,
    fromSelectToken?.networkId,
    fromSelectToken?.decimals,
    swapNativeTokenReserveGas,
    intl,
    reserveGasFormatter,
  ]);

  const onBalanceMaxPress = useCallback(() => {
    const maxAmount = checkNativeTokenGasToast();
    if (focusSwapPro && swapProTradeType === ESwapProTradeType.MARKET) {
      setSwapProInputAmount(maxAmount?.toFixed() ?? '');
    } else {
      setFromInputAmount({
        value: maxAmount?.toFixed() ?? '',
        isInput: true,
      });
    }
  }, [
    checkNativeTokenGasToast,
    focusSwapPro,
    setFromInputAmount,
    setSwapProInputAmount,
    swapProTradeType,
  ]);

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
        if (stage === 100) {
          onBalanceMaxPress();
          return;
        }
        if (focusSwapPro && swapProTradeType === ESwapProTradeType.MARKET) {
          setSwapProInputAmount(amountAfterDecimal.toFixed());
        } else {
          setFromInputAmount({
            value: amountAfterDecimal.toFixed(),
            isInput: true,
          });
        }
      }
    },
    [
      fromTokenBalance,
      fromSelectToken?.decimals,
      focusSwapPro,
      swapProTradeType,
      onBalanceMaxPress,
      setSwapProInputAmount,
      setFromInputAmount,
    ],
  );

  const isWrapped = useMemo(
    () =>
      checkWrappedTokenPair({
        fromToken: fromSelectToken,
        toToken: toSelectToken,
      }) || currentQuoteRes?.isWrapped,
    [fromSelectToken, toSelectToken, currentQuoteRes?.isWrapped],
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
        swapType: swapTypeFinal,
        fromToken: fromSelectToken,
        toToken: toSelectToken,
        shouldFallback:
          SwapBuildShouldFallBackNetworkIds.includes(
            fromSelectToken?.networkId ?? '',
          ) || isCustomRpcUnavailable,
        fromTokenAmount:
          focusSwapPro && swapProTradeType === ESwapProTradeType.MARKET
            ? swapProInputAmount
            : fromTokenAmount.value,
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
    currentQuoteRes,
    swapBatchTransferType,
    setSwapSteps,
    swapTypeFinal,
    fromSelectToken,
    toSelectToken,
    focusSwapPro,
    swapProTradeType,
    swapProInputAmount,
    fromTokenAmount.value,
    swapToAmount.value,
    supportPreBuild,
    needFetchGas,
    shouldSignEveryTime,
    createWrapStep,
    createSignStep,
    createApproveStep,
    intl,
    createBatchApproveSwapStep,
    createSendTxStep,
    isCustomRpcUnavailable,
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
        const fromAmountBN = new BigNumber(fromTokenAmount.value);
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
    fromTokenAmount.value,
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
    }, 100);
  }, [setSwapBuildTxFetching, dialogClose, setSwapSteps]);

  const handleSelectAccountClick = useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.AccountSelectorStack,
      params: {
        num: 0,
        sceneName: EAccountSelectorSceneName.swap,
        editable: true,
        linkNetwork: true,
      },
    });
  }, [navigation]);

  const onPreSwap = useCallback(() => {
    if (focusSwapPro && !swapProAccount?.result?.addressDetail.address) {
      handleSelectAccountClick();
      return;
    }
    if (!currentQuoteRes) {
      return;
    }
    if (!focusSwapPro) {
      cleanQuoteInterval();
      setSwapShouldRefreshQuote(true);
    }
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
                      preSwapBeforeStepActions={preSwapBeforeStepActions}
                      preSwapStepsStart={preSwapStepsStart}
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
                      preSwapBeforeStepActions={preSwapBeforeStepActions}
                      preSwapStepsStart={preSwapStepsStart}
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
    focusSwapPro,
    swapProAccount?.result?.addressDetail.address,
    currentQuoteRes,
    parseQuoteResultToSteps,
    setSwapBuildTxFetching,
    handleSelectAccountClick,
    cleanQuoteInterval,
    setSwapShouldRefreshQuote,
    pageType,
    InModalDialog,
    onPreSwapClose,
    intl,
    preSwapBeforeStepActions,
    preSwapStepsStart,
    handleConfirm,
    InTabDialog,
  ]);

  const onOpenOrdersClick = useCallback(
    (item: IFetchLimitOrderRes) => {
      dismissKeyboard();
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.LimitOrderDetail,
        params: {
          orderId: item.orderId,
          orderItem: item,
          storeName,
        },
      });
    },
    [navigation, storeName],
  );
  const scrollViewRef = useRef<ScrollViewNative>(null);
  const onTokenPress = useCallback(
    (token: ISwapToken) => {
      if (focusSwapPro) {
        void setSwapProSelectToken(token);
      } else {
        if (
          equalTokenNoCaseSensitive({
            token1: swapToTokenRef.current,
            token2: token,
          })
        ) {
          setSwapSelectToToken(swapFromTokenRef.current);
        }
        void selectFromToken(token);
        scrollViewRef.current?.scrollTo({
          y: 0,
          animated: true,
        });
      }
    },
    [
      focusSwapPro,
      selectFromToken,
      setSwapProSelectToken,
      setSwapSelectToToken,
    ],
  );

  const { networkList: SwapProSupportNetworksList } = useSwapProInit();
  const [swapBridgeSupportNetworksList] =
    useSwapNetworksIncludeAllNetworkAtom();
  const swapBridgeSupportNetworksFilterAllNet = useMemo(() => {
    return swapBridgeSupportNetworksList.filter((item) => !item.isAllNetworks);
  }, [swapBridgeSupportNetworksList]);
  const {
    isLoading,
    speedConfig,
    balanceLoading,
    isMEV,
    hasEnoughBalance,
    supportSpeedSwap,
  } = useSwapProTokenInit();

  useSwapProErrorAlert(!supportSpeedSwap);
  useSwapQuote();

  const renderSwapSwapBridgeContainer = useCallback(() => {
    if (!platformEnv.isNative) {
      return (
        <SwapOldSwapBridgeLimitContainer
          pageType={pageType ?? EPageType.modal}
          storeName={storeName}
          onSelectToken={onSelectToken}
          fetchLoading={fetchLoading}
          onSelectPercentageStage={onSelectPercentageStage}
          onBalanceMaxPress={onBalanceMaxPress}
          onPreSwap={onPreSwap}
          onToAnotherAddressModal={onToAnotherAddressModal}
          onOpenProviderList={onOpenProviderList}
          refreshAction={refreshAction}
          quoteResult={quoteResult}
          quoteLoading={quoteLoading}
          quoteEventFetching={quoteEventFetching}
          swapTypeSwitch={swapTypeSwitch}
          alerts={alerts}
          isWrapped={!!isWrapped}
          onSelectRecentTokenPairs={onSelectRecentTokenPairs}
          fromTokenAmountValue={fromTokenAmount.value}
          swapRecentTokenPairs={swapRecentTokenPairs}
        />
      );
    }
    if (swapTypeSwitch === ESwapTabSwitchType.SWAP) {
      return (
        <SwapSwapMbContainer
          pageType={pageType ?? EPageType.modal}
          onSelectToken={onSelectToken}
          fetchLoading={fetchLoading}
          onSelectPercentageStage={onSelectPercentageStage}
          onBalanceMaxPress={onBalanceMaxPress}
          onPreSwap={onPreSwap}
          onToAnotherAddressModal={onToAnotherAddressModal}
          onOpenProviderList={onOpenProviderList}
          refreshAction={refreshAction}
          quoteResult={quoteResult}
          quoteLoading={quoteLoading}
          quoteEventFetching={quoteEventFetching}
          alerts={alerts}
          onTokenPress={onTokenPress}
          onSelectRecentTokenPairs={onSelectRecentTokenPairs}
          onOpenOrdersClick={onOpenOrdersClick}
          fromTokenAmountValue={fromTokenAmount.value}
          swapRecentTokenPairs={swapRecentTokenPairs}
          supportNetworksList={swapBridgeSupportNetworksFilterAllNet}
        />
      );
    }
    return (
      <SwapBridgeMdContainer
        pageType={pageType ?? EPageType.modal}
        onSelectToken={onSelectToken}
        fetchLoading={fetchLoading}
        onSelectPercentageStage={onSelectPercentageStage}
        onBalanceMaxPress={onBalanceMaxPress}
        onPreSwap={onPreSwap}
        onToAnotherAddressModal={onToAnotherAddressModal}
        onOpenProviderList={onOpenProviderList}
        refreshAction={refreshAction}
        quoteResult={quoteResult}
        quoteLoading={quoteLoading}
        quoteEventFetching={quoteEventFetching}
        alerts={alerts}
        onTokenPress={onTokenPress}
        onSelectRecentTokenPairs={onSelectRecentTokenPairs}
        onOpenOrdersClick={onOpenOrdersClick}
        fromTokenAmountValue={fromTokenAmount.value}
        swapRecentTokenPairs={swapRecentTokenPairs}
        supportNetworksList={swapBridgeSupportNetworksFilterAllNet}
      />
    );
  }, [
    swapTypeSwitch,
    pageType,
    onSelectToken,
    fetchLoading,
    onSelectPercentageStage,
    onBalanceMaxPress,
    onPreSwap,
    onToAnotherAddressModal,
    onOpenProviderList,
    refreshAction,
    quoteResult,
    quoteLoading,
    quoteEventFetching,
    alerts,
    onTokenPress,
    onSelectRecentTokenPairs,
    onOpenOrdersClick,
    fromTokenAmount.value,
    swapRecentTokenPairs,
    swapBridgeSupportNetworksFilterAllNet,
    storeName,
    isWrapped,
  ]);

  return (
    <YStack
      testID="swap-content-container"
      flex={1}
      marginHorizontal="auto"
      width="100%"
      maxWidth={pageType === EPageType.modal ? '100%' : 500}
      pt="$2.5"
      $gtMd={{
        flex: 'unset',
        pt: pageType === EPageType.modal ? '$2.5' : '$5',
      }}
    >
      <SwapTipsContainer />
      <SwapHeaderContainer
        pageType={pageType}
        defaultSwapType={swapInitParams?.swapTabSwitchType}
        showSwapPro={platformEnv.isNative}
      />
      {focusSwapPro ? (
        <SwapProContainer
          onProSelectToken={onProSelectToken}
          onOpenOrdersClick={onOpenOrdersClick}
          onSwapProActionClick={onPreSwap}
          onSelectPercentageStage={onSelectPercentageStage}
          onBalanceMaxPress={onBalanceMaxPress}
          handleSelectAccountClick={handleSelectAccountClick}
          onProMarketDetail={onProMarketDetail}
          onTokenPress={onTokenPress}
          supportNetworksList={SwapProSupportNetworksList}
          config={{
            isLoading,
            speedConfig,
            balanceLoading,
            isMEV,
            hasEnoughBalance,
          }}
        />
      ) : (
        renderSwapSwapBridgeContainer()
      )}
    </YStack>
  );
};

const SwapMainLandWithPageType = (props: ISwapMainLoadProps) => {
  return (
    <SwapProviderMirror
      storeName={
        props?.pageType === EPageType.modal
          ? EJotaiContextStoreNames.swapModal
          : EJotaiContextStoreNames.swap
      }
    >
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <LazyPageContainer>
          <SwapMainLoad {...props} pageType={props?.pageType} />
        </LazyPageContainer>
      </MarketWatchListProviderMirrorV2>
    </SwapProviderMirror>
  );
};

export default SwapMainLandWithPageType;
