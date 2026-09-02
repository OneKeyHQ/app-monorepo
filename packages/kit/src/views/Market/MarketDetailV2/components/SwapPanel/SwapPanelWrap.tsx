import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  EInPageDialogType,
  Toast,
  useInPageDialog,
  useIsOverlayPage,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCustomRpcAvailability } from '@onekeyhq/kit/src/hooks/useCustomRpcAvailability';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { isOndoStockSource } from '@onekeyhq/kit/src/views/Market/components/utils/stockSource';
import { filterStockPayTokenCandidates } from '@onekeyhq/kit/src/views/Swap/hooks/swapStockChannelUtils';
import { SwapProviderMirror } from '@onekeyhq/kit/src/views/Swap/pages/SwapProviderMirror';
import {
  createGasAccountReviewSession,
  logGasAccountReviewExit,
  markGasAccountReviewSubmitted,
} from '@onekeyhq/kit/src/views/Swap/utils/gasAccountAnalytics';
import type { ISwapReviewAdapter } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import {
  EJotaiContextStoreNames,
  useSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';
import {
  ESwapNetworkFeeLevel,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  isStockTokenVariantTradable,
  useStockDetail,
} from '../../hooks/StockDetailContext';
import { useTokenDetail } from '../../hooks/useTokenDetail';

import {
  EMarketPresetKey,
  EMarketPresetTradeSide,
  getMarketNonPresetSlippageValue,
  resolveMarketPresetEnabled,
  resolveMarketQuoteSlippageMode,
  shouldShowMarketPresetReviewCustomNetworkFeeOption,
} from './hooks/marketPresetSettings';
import { useMarketPresetSettings } from './hooks/useMarketPresetSettings';
import { useSpeedSwapActions } from './hooks/useSpeedSwapActions';
import { useSpeedSwapInit } from './hooks/useSpeedSwapInit';
import { useSwapPanel } from './hooks/useSwapPanel';
import { ESwapDirection } from './hooks/useTradeType';
import { MarketSwapReviewDialog } from './MarketSwapReviewDialog';
import { SwapPanelContent } from './SwapPanelContent';

import type {
  IEstimateMarketPresetPriorityFeeFiatValues,
  IMarketPresetPriorityFeeFiatEstimateMap,
} from './components/MarketPresetSelector';
import type { IToken } from './types';

interface ISwapPanelWrapProps {
  onCloseDialog?: () => void;
  stockDetailDesktopLayout?: boolean;
  portfolioData?: IMarketAccountPortfolioItem[];
}

function SwapPanelWrapContent({
  onCloseDialog,
  stockDetailDesktopLayout,
  portfolioData,
}: ISwapPanelWrapProps) {
  const {
    networkId,
    tokenAddress,
    isNative: currentMarketTokenIsNative,
    tokenDetail,
    isReady,
  } = useTokenDetail();
  const { isStockRoute, selectedTokenVariant, stockId } = useStockDetail();
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const isModalPage = useIsOverlayPage();
  const inPageDialog = useInPageDialog(
    isModalPage ? EInPageDialogType.inModalPage : EInPageDialogType.inTabPages,
  );
  const swapPanel = useSwapPanel({
    networkId: networkId || 'evm--1',
  });
  const [hasInitialReady, setHasInitialReady] = useState(false);
  const [readyStockTokenKey, setReadyStockTokenKey] = useState<string>();
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isReviewOpening, setIsReviewOpening] = useState(false);
  const reviewDialogRef = useRef<IDialogInstance | null>(null);
  const reviewDialogRequestIdRef = useRef(0);

  const {
    setPaymentToken,
    paymentToken,
    paymentAmount,
    sellAmount,
    tradeType,
    setSlippage,
    slippage,
  } = swapPanel;
  const { isCustomRpcUnavailable } = useCustomRpcAvailability(
    swapPanel.networkId,
  );

  const {
    isLoading: speedSwapInitLoading,
    speedConfig,
    speedConfigReady,
    supportSpeedSwap: originalSupportSpeedSwap,
    onlySupportCrossChain,
    defaultTokens,
    swapMevNetConfig,
  } = useSpeedSwapInit(networkId || '', true);
  const marketPresetSettings = useMarketPresetSettings({
    networkId: networkId || '',
    defaultSlippage: speedConfig?.slippage,
    tradeSide:
      tradeType === ESwapDirection.SELL
        ? EMarketPresetTradeSide.SELL
        : EMarketPresetTradeSide.BUY,
    speedConfig,
    speedConfigReady,
  });
  const [
    { swapSlippagePercentageCustomValue, swapSlippagePercentageMode },
    setSettings,
  ] = useSettingsAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { result: accountNetworkNotSupported } = usePromiseResult(
    async () => {
      const result =
        await backgroundApiProxy.serviceAccount.checkAccountNetworkNotSupported(
          {
            walletId: activeAccount?.wallet?.id ?? '',
            accountId: activeAccount?.account?.id ?? '',
            accountImpl: activeAccount?.account?.impl,
            activeNetworkId: networkId ?? '',
          },
        );
      return !!result?.networkImpl;
    },
    [
      activeAccount?.wallet?.id,
      activeAccount?.account?.id,
      activeAccount?.account?.impl,
      networkId,
    ],
    {
      initResult: undefined,
    },
  );

  const supportSpeedSwap = useMemo(() => {
    let isAccountNetworkSupported: boolean;
    if (accountNetworkNotSupported) {
      isAccountNetworkSupported = false;
    } else {
      isAccountNetworkSupported = true;
    }

    const speedSwapEnabled = originalSupportSpeedSwap;
    const tokenSwapEnabled = tokenDetail?.supportSwap?.enable !== false;
    const isEnabled =
      speedSwapEnabled && tokenSwapEnabled && isAccountNetworkSupported;
    let warningMessage = !tokenSwapEnabled
      ? tokenDetail?.supportSwap?.warningMessage
      : undefined;
    if (!isAccountNetworkSupported && !warningMessage) {
      warningMessage = intl.formatMessage({
        id: ETranslations.swap_page_alert_account_does_not_support_swap,
      });
    }
    const actionToken: ISwapToken | undefined = {
      networkId: networkId || '',
      contractAddress: tokenDetail?.address || '',
      symbol: tokenDetail?.symbol || '',
      decimals: tokenDetail?.decimals || 0,
      logoURI: tokenDetail?.logoUrl || '',
      isNative: !!tokenDetail?.isNative,
    };
    const actionOtherToken: ISwapToken | undefined = {
      networkId: paymentToken?.networkId || '',
      contractAddress: paymentToken?.contractAddress || '',
      symbol: paymentToken?.symbol || '',
      decimals: paymentToken?.decimals || 0,
      logoURI: paymentToken?.logoURI || '',
      isNative: paymentToken?.isNative || false,
    };
    return {
      enabled: isEnabled,
      isAccountNetworkSupported,
      warningMessage,
      actionToken,
      actionOtherToken,
      onlySupportCrossChain,
    };
  }, [
    accountNetworkNotSupported,
    intl,
    networkId,
    onlySupportCrossChain,
    originalSupportSpeedSwap,
    paymentToken?.contractAddress,
    paymentToken?.decimals,
    paymentToken?.isNative,
    paymentToken?.logoURI,
    paymentToken?.networkId,
    paymentToken?.symbol,
    tokenDetail?.address,
    tokenDetail?.decimals,
    tokenDetail?.isNative,
    tokenDetail?.logoUrl,
    tokenDetail?.supportSwap?.enable,
    tokenDetail?.supportSwap?.warningMessage,
    tokenDetail?.symbol,
  ]);

  const nonPresetSlippage = getMarketNonPresetSlippageValue({
    mode: swapSlippagePercentageMode,
    customValue: swapSlippagePercentageCustomValue,
    defaultSlippage: speedConfig?.slippage,
  });
  const marketPresetEnabled = resolveMarketPresetEnabled({
    enabled: marketPresetSettings.enabled,
    stockDetailDesktopLayout,
  });
  const marketPresetLoading =
    !stockDetailDesktopLayout && marketPresetSettings.isLoading;
  const effectiveSlippage = marketPresetEnabled
    ? marketPresetSettings.selectedSlippageValue
    : (nonPresetSlippage ?? slippage);
  const effectiveSlippageMode = resolveMarketQuoteSlippageMode({
    presetEnabled: marketPresetEnabled,
    selectedPresetKey: marketPresetSettings.selectedPresetKey,
    nonPresetMode: swapSlippagePercentageMode,
  });
  const effectiveNetworkFeeLevel = marketPresetEnabled
    ? marketPresetSettings.selectedNetworkFeeLevel
    : ESwapNetworkFeeLevel.MEDIUM;
  const effectiveCustomPriorityFee = marketPresetEnabled
    ? marketPresetSettings.selectedPriorityFeeOverride
    : undefined;
  const shouldUseConvertedMarketPrice =
    currencyInfo.id !== 'usd' && Boolean(tokenDetail?.priceConverted);
  const marketTokenPrice = shouldUseConvertedMarketPrice
    ? tokenDetail?.priceConverted
    : tokenDetail?.price;
  const marketTokenCurrency = shouldUseConvertedMarketPrice
    ? currencyInfo.id
    : 'usd';
  const selectedVariantMatchesTokenDetail = Boolean(
    selectedTokenVariant &&
    equalTokenNoCaseSensitive({
      token1: {
        networkId: selectedTokenVariant.networkId,
        contractAddress: selectedTokenVariant.contractAddress,
      },
      token2: {
        networkId,
        contractAddress: tokenDetail?.address,
      },
    }),
  );
  const selectedVariantTradable = selectedTokenVariant
    ? isStockTokenVariantTradable(selectedTokenVariant)
    : false;
  const stockTokenToAssetRatio =
    selectedTokenVariant?.tokenToAssetRatio ??
    tokenDetail?.stock?.tokenToAssetRatio;
  const currentStockInfo =
    isStockRoute && tokenDetail?.stock
      ? {
          ...tokenDetail.stock,
          tokenToAssetRatio: stockTokenToAssetRatio,
        }
      : undefined;
  const currentMarketToken: ISwapToken = selectedTokenVariant
    ? {
        networkId: selectedTokenVariant.networkId,
        contractAddress: selectedTokenVariant.contractAddress,
        symbol:
          selectedTokenVariant.symbol ||
          (selectedVariantMatchesTokenDetail ? tokenDetail?.symbol : '') ||
          '',
        name:
          selectedTokenVariant.name ||
          (selectedVariantMatchesTokenDetail ? tokenDetail?.name : '') ||
          '',
        decimals: selectedVariantMatchesTokenDetail
          ? (tokenDetail?.decimals ?? 0)
          : 0,
        logoURI:
          selectedTokenVariant.logoUrl ||
          (selectedVariantMatchesTokenDetail ? tokenDetail?.logoUrl : '') ||
          '',
        price:
          selectedTokenVariant.price ||
          (selectedVariantMatchesTokenDetail ? marketTokenPrice : '') ||
          '',
        currency: 'usd',
        isNative: false,
        isStock: isStockRoute,
        stock: currentStockInfo,
      }
    : {
        networkId: networkId || '',
        contractAddress: tokenDetail?.address || '',
        symbol: tokenDetail?.symbol || '',
        name: tokenDetail?.name || '',
        decimals: tokenDetail?.decimals || 0,
        logoURI: tokenDetail?.logoUrl || '',
        price: marketTokenPrice || '',
        currency: marketTokenCurrency,
        isNative: !!tokenDetail?.isNative,
        isStock: isStockRoute,
        stock: currentStockInfo,
      };
  const currentFromTokenAmount =
    tradeType === ESwapDirection.BUY
      ? paymentAmount.toFixed()
      : sellAmount.toFixed();
  const currentMarketTokenKey = currentMarketToken.networkId
    ? `${currentMarketToken.networkId}:${
        currentMarketToken.isNative
          ? 'native'
          : currentMarketToken.contractAddress
      }`
    : undefined;
  const isCurrentStockTokenReady =
    Boolean(currentMarketTokenKey) &&
    readyStockTokenKey === currentMarketTokenKey;
  const useSpeedSwapActionsParams = {
    slippageItem: {
      key: effectiveSlippageMode,
      value: effectiveSlippage,
    },
    // Market status never gates quoting. A live open-state flip only refreshes
    // the current provider quote so a server-reported closed error can recover.
    stockIsOpen: tokenDetail?.stock?.isOpen,
    marketToken: currentMarketToken,
    tradeToken: {
      networkId: paymentToken?.networkId || '',
      contractAddress: paymentToken?.contractAddress || '',
      symbol: paymentToken?.symbol || '',
      decimals: paymentToken?.decimals || 0,
      logoURI: paymentToken?.logoURI || '',
      price: paymentToken?.price || '',
      currency: paymentToken?.currency,
      isNative: paymentToken?.isNative || false,
    },
    tradeType: tradeType || ESwapDirection.BUY,
    swapType: isStockRoute ? ESwapTabSwitchType.STOCK : ESwapTabSwitchType.SWAP,
    fromTokenAmount: currentFromTokenAmount,
    antiMEV: Array.isArray(swapMevNetConfig)
      ? swapMevNetConfig.includes(swapPanel.networkId ?? '')
      : false,
    isCustomRpcUnavailable,
    isReviewDialogOpen,
    onCloseDialog,
  };

  const speedSwapActions = useSpeedSwapActions(useSpeedSwapActionsParams);

  const {
    speedSwapBuildTxLoading,
    swapApprovingMatchLoading,
    checkTokenAllowanceLoading,
    balance,
    balanceToken,
    fetchBalanceLoading,
    priceRate,
    stockQuoteDisplay,
    quoteResult,
    quoteList,
    quoteActionLoading,
    quoteError,
    quoteReadyForReview,
    quoteNeedsRefresh,
    quoteRefreshActionActive,
    refreshMarketQuote,
    forceRefreshMarketQuote,
    paymentTokenPrice,
    swapNativeTokenReserveGas,
    isWrapped,
    estimateMarketPresetNetworkFees,
    prepareMarketSwapReview,
    rebuildMarketSwapReview,
    logMarketReviewGasAccountDecision,
    sendMarketApproveTx,
    sendMarketSwapTx,
    sendMarketWrappedTx,
    sendMarketSignMessage,
    buildMarketApproveInfos,
  } = speedSwapActions;

  const { result: mergeDeriveAssetsEnabled } = usePromiseResult(async () => {
    const balanceNetworkId = balanceToken?.networkId;
    // The payment token settles asynchronously after the panel mounts, and
    // getVaultSettings throws on an empty networkId instead of returning a
    // default — which surfaces as an unhandled rejection on every mount.
    if (!balanceNetworkId) {
      return undefined;
    }
    const result = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: balanceNetworkId,
    });
    return result?.mergeDeriveAssetsEnabled;
  }, [balanceToken?.networkId]);

  const disableNativeToken =
    isOndoStockSource(tokenDetail?.stock?.source) &&
    tradeType === ESwapDirection.BUY;

  const currentMarketTokenForFilter = useMemo(() => {
    const effectiveNetworkId = networkId || '';
    if (!effectiveNetworkId) {
      return undefined;
    }

    // Token detail is intentionally cleared during token switches to avoid
    // showing stale data. Use the route identity first so native tokens like
    // SOL are not mis-filtered while async detail is still loading.
    if (tokenAddress || currentMarketTokenIsNative) {
      return {
        networkId: effectiveNetworkId,
        contractAddress: tokenAddress || '',
        symbol: tokenDetail?.symbol || '',
        isNative: currentMarketTokenIsNative,
      };
    }

    const hasTokenDetailIdentity =
      !!tokenDetail?.address ||
      !!tokenDetail?.symbol ||
      tokenDetail?.isNative !== undefined;

    if (!hasTokenDetailIdentity) {
      return undefined;
    }

    return {
      networkId: effectiveNetworkId,
      contractAddress: tokenDetail?.address || '',
      symbol: tokenDetail?.symbol || '',
      isNative: tokenDetail?.isNative,
    };
  }, [
    currentMarketTokenIsNative,
    networkId,
    tokenAddress,
    tokenDetail?.address,
    tokenDetail?.isNative,
    tokenDetail?.symbol,
  ]);

  const compatibleDefaultTokens = useMemo(
    () =>
      isStockRoute
        ? filterStockPayTokenCandidates(defaultTokens)
        : defaultTokens,
    [defaultTokens, isStockRoute],
  );

  const filterDefaultTokens = useMemo(() => {
    if (compatibleDefaultTokens.length === 1) {
      return [...compatibleDefaultTokens];
    }

    if (!currentMarketTokenForFilter) {
      return [...compatibleDefaultTokens];
    }

    return compatibleDefaultTokens.filter(
      (token) =>
        !equalTokenNoCaseSensitive({
          token1: token,
          token2: currentMarketTokenForFilter,
        }),
    );
  }, [compatibleDefaultTokens, currentMarketTokenForFilter]);

  // --- Token preference persistence (simpledb) ---
  const { result: savedPreference, isLoading: savedPreferenceLoading } =
    usePromiseResult(
      async () => {
        const effectiveNetworkId = networkId || '';
        if (!effectiveNetworkId) return undefined;
        return backgroundApiProxy.simpleDb.marketTokenPreference.getPreference({
          networkId: effectiveNetworkId,
        });
      },
      [networkId],
      { revalidateOnFocus: true, watchLoading: true },
    );

  const findPreferredToken = useCallback(
    (tokens: IToken[]): IToken | undefined => {
      if (!savedPreference || tokens.length === 0) return undefined;
      return tokens.find((token) =>
        equalTokenNoCaseSensitive({
          token1: token,
          token2: savedPreference,
        }),
      );
    },
    [savedPreference],
  );

  const saveTokenPreference = useCallback(
    (token: IToken) => {
      const effectiveNetworkId = networkId || '';
      if (!effectiveNetworkId) return;
      void backgroundApiProxy.simpleDb.marketTokenPreference.setPreference({
        networkId: effectiveNetworkId,
        preference: {
          contractAddress: token.contractAddress,
          symbol: token.symbol,
          networkId: token.networkId,
        },
      });
    },
    [networkId],
  );

  // Wrap setPaymentToken to also persist user's choice
  const handleUserPaymentTokenChange: typeof setPaymentToken = useCallback(
    (tokenOrUpdater) => {
      setPaymentToken(tokenOrUpdater);
      if (tokenOrUpdater && typeof tokenOrUpdater !== 'function') {
        saveTokenPreference(tokenOrUpdater);
      }
    },
    [setPaymentToken, saveTokenPreference],
  );

  // Initialize paymentToken: prefer saved preference, fallback to first default
  // Exclude native tokens when the current BUY flow requires it
  useEffect(() => {
    const candidates = disableNativeToken
      ? filterDefaultTokens.filter((t) => !t.isNative)
      : filterDefaultTokens;

    if (savedPreferenceLoading !== false) {
      return;
    }

    if (candidates.length > 0 && !paymentToken?.networkId) {
      const preferred = findPreferredToken(candidates);
      setPaymentToken(preferred || candidates[0]);
      return;
    }
    // Stock BUY mode: auto-switch away from native token
    if (disableNativeToken && paymentToken?.isNative && candidates.length > 0) {
      setPaymentToken(candidates[0]);
      return;
    }
    if (
      candidates.length > 0 &&
      candidates.every(
        (token) =>
          token.networkId !== paymentToken?.networkId ||
          token.contractAddress !== paymentToken?.contractAddress,
      )
    ) {
      const preferred = findPreferredToken(candidates);
      setPaymentToken(preferred || candidates[0]);
    }
  }, [
    disableNativeToken,
    paymentToken?.networkId,
    paymentToken?.contractAddress,
    paymentToken?.isNative,
    setPaymentToken,
    filterDefaultTokens,
    findPreferredToken,
    savedPreferenceLoading,
  ]);

  useEffect(() => {
    if (!marketPresetEnabled) {
      return;
    }

    setSlippage(marketPresetSettings.selectedSlippageValue);
  }, [
    marketPresetEnabled,
    marketPresetSettings.selectedSlippageValue,
    setSlippage,
  ]);

  useEffect(() => {
    if (marketPresetEnabled) {
      return;
    }

    if (nonPresetSlippage !== undefined) {
      setSlippage(nonPresetSlippage);
    }
  }, [marketPresetEnabled, nonPresetSlippage, setSlippage]);

  const saveMarketSlippageForFutureOrders = useCallback(
    async (slippagePercentage: number) => {
      setSlippage(slippagePercentage);
      if (!marketPresetEnabled) {
        setSettings((prev) => ({
          ...prev,
          swapSlippagePercentageMode: ESwapSlippageSegmentKey.CUSTOM,
          swapSlippagePercentageCustomValue: slippagePercentage,
        }));
        return;
      }
      await marketPresetSettings.onSavePresetDirectionSettings({
        presetKey: marketPresetSettings.selectedPresetKey,
        tradeSide: marketPresetSettings.tradeSide,
        settings: {
          ...marketPresetSettings.selectedDirectionSettings,
          slippage: {
            key: ESwapSlippageSegmentKey.CUSTOM,
            value: slippagePercentage,
          },
        },
      });
    },
    [marketPresetEnabled, marketPresetSettings, setSettings, setSlippage],
  );

  const reviewAdapter = useMemo<ISwapReviewAdapter>(
    () => ({
      prepareReview: prepareMarketSwapReview,
      rebuildReview: rebuildMarketSwapReview,
      saveSlippageForFutureOrders: saveMarketSlippageForFutureOrders,
      sendApproveTx: sendMarketApproveTx,
      sendSwapTx: sendMarketSwapTx,
      sendWrappedTx: sendMarketWrappedTx,
      sendSignMessage: sendMarketSignMessage,
      buildApproveInfos: buildMarketApproveInfos,
    }),
    [
      buildMarketApproveInfos,
      prepareMarketSwapReview,
      rebuildMarketSwapReview,
      saveMarketSlippageForFutureOrders,
      sendMarketApproveTx,
      sendMarketSwapTx,
      sendMarketWrappedTx,
      sendMarketSignMessage,
    ],
  );

  const estimatePriorityFeeFiatValues =
    useCallback<IEstimateMarketPresetPriorityFeeFiatValues>(
      async ({ items }) => {
        const estimates: IMarketPresetPriorityFeeFiatEstimateMap = {};
        const feeValues = await estimateMarketPresetNetworkFees({
          items: items.map((item) => ({
            customPriorityFee: item.customPriorityFee,
            networkFeeLevel: item.networkFeeLevel,
          })),
        });

        items.forEach((item, index) => {
          estimates[item.type] = feeValues[index];
        });

        return estimates;
      },
      [estimateMarketPresetNetworkFees],
    );

  const isActionLoading = useMemo(() => {
    return (
      speedSwapBuildTxLoading ||
      swapApprovingMatchLoading ||
      checkTokenAllowanceLoading ||
      quoteActionLoading
    );
  }, [
    checkTokenAllowanceLoading,
    quoteActionLoading,
    speedSwapBuildTxLoading,
    swapApprovingMatchLoading,
  ]);

  const openReviewDialog = useCallback(
    async (isWrap?: boolean) => {
      if (isActionLoading || isReviewOpening || marketPresetLoading) {
        return;
      }
      if (!isWrap && !quoteReadyForReview) {
        if (quoteNeedsRefresh) {
          refreshMarketQuote();
        }
        return;
      }

      const requestId = reviewDialogRequestIdRef.current + 1;
      reviewDialogRequestIdRef.current = requestId;
      setIsReviewOpening(true);
      const showReviewCustomNetworkFeeOption =
        marketPresetEnabled &&
        shouldShowMarketPresetReviewCustomNetworkFeeOption(
          marketPresetSettings,
        );

      try {
        const nextReviewState = await prepareMarketSwapReview({
          isWrap,
          networkFeeLevel: effectiveNetworkFeeLevel,
          customPriorityFee: effectiveCustomPriorityFee,
        });
        if (reviewDialogRequestIdRef.current !== requestId) {
          return;
        }
        const previousDialog = reviewDialogRef.current;
        if (previousDialog) {
          reviewDialogRef.current = null;
          void previousDialog.close();
        }
        setIsReviewDialogOpen(true);
        const gasAccountReviewSession = createGasAccountReviewSession();
        let dialog: IDialogInstance | null = null;
        dialog = inPageDialog.show({
          title: intl.formatMessage({
            id: ETranslations.global_review_order,
          }),
          showFooter: false,
          showCancelButton: false,
          showConfirmButton: false,
          onClose: () => {
            if (reviewDialogRef.current !== dialog) {
              return;
            }
            logGasAccountReviewExit(gasAccountReviewSession);
            reviewDialogRef.current = null;
            setIsReviewDialogOpen(false);
          },
          renderContent: (
            <MarketSwapReviewDialog
              adapter={reviewAdapter}
              disableSaveSlippageForFutureOrders={
                marketPresetEnabled &&
                marketPresetSettings.selectedPresetKey === EMarketPresetKey.AUTO
              }
              defaultNetworkFeeLevel={effectiveNetworkFeeLevel}
              defaultCustomPriorityFee={effectiveCustomPriorityFee}
              showCustomNetworkFeeOption={showReviewCustomNetworkFeeOption}
              reviewState={nextReviewState}
              onConfirmStart={() =>
                markGasAccountReviewSubmitted(gasAccountReviewSession)
              }
              onDone={() => void dialog?.close()}
            />
          ),
        });
        if (reviewDialogRequestIdRef.current !== requestId) {
          setIsReviewDialogOpen(false);
          void dialog.close();
          return;
        }
        reviewDialogRef.current = dialog;
        gasAccountReviewSession.analyticsContext =
          logMarketReviewGasAccountDecision();
      } catch (error) {
        if (reviewDialogRequestIdRef.current !== requestId) {
          return;
        }
        Toast.error({
          title:
            error instanceof Error
              ? error.message
              : intl.formatMessage({
                  id: ETranslations.global_unknown_error,
                }),
        });
      } finally {
        if (reviewDialogRequestIdRef.current === requestId) {
          setIsReviewOpening(false);
        }
      }
    },
    [
      inPageDialog,
      intl,
      isActionLoading,
      isReviewOpening,
      effectiveCustomPriorityFee,
      effectiveNetworkFeeLevel,
      marketPresetEnabled,
      marketPresetLoading,
      marketPresetSettings,
      logMarketReviewGasAccountDecision,
      prepareMarketSwapReview,
      quoteNeedsRefresh,
      quoteReadyForReview,
      refreshMarketQuote,
      reviewAdapter,
    ],
  );

  const handleSwap = useCallback(
    () => openReviewDialog(false),
    [openReviewDialog],
  );

  const handleWrappedSwap = useCallback(
    () => openReviewDialog(true),
    [openReviewDialog],
  );

  const navigation = useAppNavigation();
  const handleOpenProviderList = useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProviderSelect,
      params: {
        storeName: EJotaiContextStoreNames.marketSwap,
      },
    });
  }, [navigation]);

  const handleOpenRecipientAddress = useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapToAnotherAddress,
      params: {
        storeName: EJotaiContextStoreNames.marketSwap,
      },
    });
  }, [navigation]);

  useEffect(() => {
    return () => {
      dismissKeyboard();
    };
  }, []);

  useEffect(() => {
    if (
      !isActionLoading &&
      isReady &&
      !speedSwapInitLoading &&
      originalSupportSpeedSwap !== undefined
    ) {
      setHasInitialReady(true);
    }
  }, [
    isActionLoading,
    isReady,
    originalSupportSpeedSwap,
    speedSwapInitLoading,
  ]);

  useEffect(() => {
    if (
      stockDetailDesktopLayout &&
      !isActionLoading &&
      isReady &&
      speedConfigReady &&
      !speedSwapInitLoading &&
      originalSupportSpeedSwap !== undefined &&
      savedPreferenceLoading === false &&
      currentMarketTokenKey &&
      selectedTokenVariant &&
      paymentToken?.networkId
    ) {
      setReadyStockTokenKey(currentMarketTokenKey);
    }
  }, [
    currentMarketTokenKey,
    isActionLoading,
    isReady,
    originalSupportSpeedSwap,
    paymentToken?.networkId,
    savedPreferenceLoading,
    selectedTokenVariant,
    speedConfigReady,
    speedSwapInitLoading,
    stockDetailDesktopLayout,
  ]);

  // Override setPaymentToken so user-initiated changes are persisted
  const swapPanelWithPreference = useMemo(
    () => ({
      ...swapPanel,
      setPaymentToken: handleUserPaymentTokenChange,
    }),
    [swapPanel, handleUserPaymentTokenChange],
  );

  return (
    <SwapPanelContent
      activeAccount={activeAccount}
      enableAddressTypeSelector={!!mergeDeriveAssetsEnabled}
      currentMarketToken={currentMarketToken}
      onCloseDialog={onCloseDialog}
      priceRate={priceRate}
      stockQuoteDisplay={stockQuoteDisplay}
      stockTokenToAssetRatio={stockTokenToAssetRatio}
      stockUnderlyingSymbol={stockId}
      swapMevNetConfig={swapMevNetConfig}
      swapNativeTokenReserveGas={swapNativeTokenReserveGas}
      swapPanel={swapPanelWithPreference}
      balance={balance}
      balanceToken={balanceToken as IToken}
      balanceLoading={fetchBalanceLoading}
      paymentTokenPrice={paymentTokenPrice}
      isLoading={isActionLoading || isReviewOpening}
      quoteLoading={quoteActionLoading}
      isActionDisabled={
        (isStockRoute && !selectedVariantTradable) ||
        (selectedTokenVariant && !selectedVariantMatchesTokenDetail) ||
        marketPresetLoading ||
        (!isWrapped && !quoteReadyForReview && !quoteNeedsRefresh)
      }
      isRefreshQuote={quoteRefreshActionActive}
      onRefreshQuote={refreshMarketQuote}
      onForceRefreshQuote={forceRefreshMarketQuote}
      hasInitialReady={
        stockDetailDesktopLayout ? isCurrentStockTokenReady : hasInitialReady
      }
      onSwap={handleSwap}
      onOpenRecipientAddress={handleOpenRecipientAddress}
      slippageAutoValue={speedConfig?.slippage}
      supportSpeedSwap={{
        ...supportSpeedSwap,
        actionToken: currentMarketToken,
      }}
      defaultTokens={filterDefaultTokens}
      onWrappedSwap={handleWrappedSwap}
      isWrapped={isWrapped}
      quoteResult={quoteResult}
      quoteListLength={quoteList.length}
      onOpenProviderList={handleOpenProviderList}
      quoteError={quoteError}
      disableNativeToken={disableNativeToken}
      marketPresetSettings={
        stockDetailDesktopLayout ? undefined : marketPresetSettings
      }
      estimatePriorityFeeFiatValues={estimatePriorityFeeFiatValues}
      stockDetailDesktopLayout={stockDetailDesktopLayout}
      portfolioData={portfolioData}
    />
  );
}

export function SwapPanelWrap(props: ISwapPanelWrapProps) {
  return (
    <SwapProviderMirror storeName={EJotaiContextStoreNames.marketSwap}>
      <SwapPanelWrapContent {...props} />
    </SwapProviderMirror>
  );
}
