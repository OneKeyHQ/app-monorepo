import { useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IDialogInstance,
  IPageNavigationProp,
} from '@onekeyhq/components';
import {
  Dialog,
  EPageType,
  Page,
  Toast,
  YStack,
  useInModalDialog,
  useInTabDialog,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { LazyPageContainer } from '@onekeyhq/kit/src/components/LazyPageContainer';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCustomRpcAvailability } from '@onekeyhq/kit/src/hooks/useCustomRpcAvailability';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import {
  useSwapActions,
  useSwapAlertsAtom,
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapNativeTokenReserveGasAtom,
  useSwapNetworksAtom,
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
import { MarketWatchListProviderMirrorV2 } from '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2';
import {
  EJotaiContextStoreNames,
  useInAppNotificationAtom,
  useSettingsPersistAtom,
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
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
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
  ESwapTabSwitchType,
  LIMIT_PRICE_DEFAULT_DECIMALS,
  SwapBuildShouldFallBackNetworkIds,
  SwapBuildUseMultiplePopoversNetworkIds,
} from '@onekeyhq/shared/types/swap/types';

import TransactionLossNetworkFeeExceedDialog from '../../components/TransactionLossNetworkFeeExceedDialog';
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
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
  useSwapSlippagePercentageModeInfo,
} from '../../hooks/useSwapState';
import { buildSwapReviewState } from '../../utils/buildSwapReviewState';
import { SwapProviderMirror } from '../SwapProviderMirror';

import PreSwapDialogContent from './PreSwapDialogContent';
import SwapBridgeMdContainer from './SwapBridgeMdContainer';
import SwapHeaderContainer from './SwapHeaderContainer';
import SwapOldSwapBridgeLimitContainer from './SwapOldSwapBridgeLimitContainer';
import SwapProContainer from './SwapProContainer';
import SwapSwapMbContainer from './SwapSwapMbContainer';

import type { ScrollView as ScrollViewNative } from 'react-native';

interface ISwapMainLoadProps {
  children?: React.ReactNode;
  swapInitParams?: ISwapInitParams;
  pageType?: EPageType.modal;
}

const SwapMainLoad = ({ swapInitParams, pageType }: ISwapMainLoadProps) => {
  const { preSwapStepsStart, preSwapBeforeStepActions } = useSwapBuildTx();
  const intl = useIntl();
  const { gtLg } = useMedia();
  const { fetchLoading } = useSwapInit(swapInitParams);
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const [alerts] = useSwapAlertsAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
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
  const { setSwapProSelectToken } = useSwapActions().current;
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
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
  if (quoteResultRef.current !== swapStepData.quoteResult) {
    quoteResultRef.current = swapStepData.quoteResult;
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
        storeName,
      },
    });
  }, [navigation, storeName]);

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
        ).decimalPlaces(
          Number(fromSelectToken?.decimals ?? 6),
          BigNumber.ROUND_DOWN,
        );
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
        Number(fromSelectToken?.decimals ?? 6),
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

  const supportPreBuild = useMemo(() => {
    if (isWrapped) {
      return false;
    }
    if (quoteEventFetching) {
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
  }, [
    currentQuoteRes,
    fromSelectToken?.networkId,
    isWrapped,
    quoteEventFetching,
  ]);

  const reviewStepTexts = useMemo(
    () => ({
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
          symbol: fromSelectToken?.symbol,
        },
      ),
      approveToken: intl.formatMessage(
        {
          id: ETranslations.swap_page_approve_button,
        },
        {
          token: fromSelectToken?.symbol,
        },
      ),
      approveTokenWithTarget: intl.formatMessage(
        {
          id: ETranslations.swap_page_approve_button,
        },
        {
          token: fromSelectToken?.symbol,
          target: currentQuoteRes?.info.providerName,
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
    [currentQuoteRes?.info.providerName, fromSelectToken?.symbol, intl],
  );

  const parseQuoteResultToSteps = useCallback(() => {
    if (!currentQuoteRes) {
      return;
    }

    const nextReviewState = buildSwapReviewState({
      accountId: swapFromAddressInfo.accountInfo?.account?.id,
      networkId: swapFromAddressInfo.networkId,
      batchApproveAndSwapEnabled: settingsPersistAtom.swapBatchApproveAndSwap,
      fromToken: fromSelectToken,
      toToken: toSelectToken,
      fromTokenAmount:
        focusSwapPro && swapProTradeType === ESwapProTradeType.MARKET
          ? swapProInputAmount
          : fromTokenAmount.value,
      toTokenAmount: swapToAmount.value,
      quoteResult: currentQuoteRes,
      swapType: swapTypeFinal,
      shouldFallback:
        SwapBuildShouldFallBackNetworkIds.includes(
          fromSelectToken?.networkId ?? '',
        ) || isCustomRpcUnavailable,
      supportPreBuild,
      slippage: swapSlippageRef.current.value,
      texts: reviewStepTexts,
    });

    setSwapSteps({
      steps: [...nextReviewState.steps],
      preSwapData: nextReviewState.preSwapData,
      quoteResult: { ...(nextReviewState.quoteResult as IFetchQuoteResult) },
    });
  }, [
    currentQuoteRes,
    setSwapSteps,
    fromSelectToken,
    toSelectToken,
    focusSwapPro,
    swapProTradeType,
    swapProInputAmount,
    fromTokenAmount.value,
    swapToAmount.value,
    swapTypeFinal,
    swapFromAddressInfo.accountInfo?.account?.id,
    swapFromAddressInfo.networkId,
    settingsPersistAtom.swapBatchApproveAndSwap,
    supportPreBuild,
    isCustomRpcUnavailable,
    reviewStepTexts,
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
    if (
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
            Number(toToken?.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS),
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
  const [swapNetworks] = useSwapNetworksAtom();

  // Filter and sort networks, then stabilize reference to prevent unnecessary re-renders
  const swapBridgeSupportNetworksFilterAllNetRef = useRef<typeof swapNetworks>(
    [],
  );
  const swapBridgeSupportNetworksFilterAllNet = useMemo(() => {
    let filteredNetworks: typeof swapNetworks;
    if (swapTypeSwitch === ESwapTabSwitchType.BRIDGE) {
      filteredNetworks = swapNetworks.filter(
        (item) => !!item.supportCrossChainSwap,
      );
    } else if (swapTypeSwitch === ESwapTabSwitchType.SWAP) {
      filteredNetworks = swapNetworks.filter(
        (item) => !!item.supportSingleSwap,
      );
    } else {
      filteredNetworks = swapNetworks.filter((item) => !!item.supportLimit);
    }

    // Sort by networkId to ensure consistent order
    const sortedNetworks = filteredNetworks.toSorted((a, b) =>
      a.networkId.localeCompare(b.networkId),
    );

    // Compare networkIds to check if content actually changed
    const currentNetworkIds = sortedNetworks.map((item) => item.networkId);
    const prevNetworkIds = swapBridgeSupportNetworksFilterAllNetRef.current.map(
      (item) => item.networkId,
    );

    // Only update ref if content has actually changed
    if (!isEqual(currentNetworkIds, prevNetworkIds)) {
      swapBridgeSupportNetworksFilterAllNetRef.current = sortedNetworks;
    }

    return swapBridgeSupportNetworksFilterAllNetRef.current;
  }, [swapNetworks, swapTypeSwitch]);

  const {
    isLoading,
    speedConfig,
    balanceLoading,
    isMEV,
    hasEnoughBalance,
    supportSpeedSwap,
    onlySupportCrossChain,
  } = useSwapProTokenInit();

  useSwapProErrorAlert();
  useSwapQuote();

  const renderSwapSwapBridgeContainer = useCallback(() => {
    if (!platformEnv.isNative) {
      return (
        <SwapOldSwapBridgeLimitContainer
          pageType={pageType}
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
          headerContent={
            gtLg && pageType !== EPageType.modal ? (
              <SwapHeaderContainer
                pageType={pageType}
                defaultSwapType={swapInitParams?.swapTabSwitchType}
                showSwapPro={platformEnv.isNative}
                hideRightActions
              />
            ) : undefined
          }
        />
      );
    }
    if (swapTypeSwitch === ESwapTabSwitchType.SWAP) {
      return (
        <SwapSwapMbContainer
          pageType={pageType ?? EPageType.modal}
          swapTipsPageType={pageType}
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
        swapTipsPageType={pageType}
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
    swapInitParams?.swapTabSwitchType,
    gtLg,
  ]);

  // Desktop: show provider panel on the right side, need wider layout
  // Show when: on large desktop (gtLg), not in modal, and not on native platform
  const showDesktopProviderPanel =
    gtLg && pageType !== EPageType.modal && !platformEnv.isNative;

  const containerLayout = useMemo(() => {
    if (pageType === EPageType.modal) {
      return 'full' as const;
    }
    // Use full layout when showing desktop provider panel to allow scrolling on the entire viewport
    if (showDesktopProviderPanel) {
      return 'full' as const;
    }
    if (swapTypeSwitch === ESwapTabSwitchType.LIMIT) {
      // On native, keep compact; on non-native align with Swap/Bridge width
      if (platformEnv.isNative) {
        return 'compact' as const;
      }
      return gtLg ? ('full' as const) : ('regular' as const);
    }
    return 'regular' as const;
  }, [pageType, swapTypeSwitch, showDesktopProviderPanel, gtLg]);

  return (
    <>
      <Page.Container flex={1} layout={containerLayout} padded={false}>
        <YStack
          testID="swap-content-container"
          flex={1}
          width="100%"
          pt={pageType !== EPageType.modal ? '$5' : '$2.5'}
          gap="$2"
          $gtMd={{
            flex: 'unset',
          }}
          $gtLg={{
            pt: '$0',
          }}
        >
          {gtLg &&
          pageType !== EPageType.modal &&
          !platformEnv.isNative ? null : (
            <SwapHeaderContainer
              pageType={pageType}
              defaultSwapType={swapInitParams?.swapTabSwitchType}
              showSwapPro={platformEnv.isNative}
              hideRightActions={showDesktopProviderPanel}
            />
          )}
          {focusSwapPro ? (
            <SwapProContainer
              pageType={pageType}
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
                supportSpeedSwap,
                onlySupportCrossChain,
              }}
            />
          ) : (
            renderSwapSwapBridgeContainer()
          )}
        </YStack>
      </Page.Container>
    </>
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
