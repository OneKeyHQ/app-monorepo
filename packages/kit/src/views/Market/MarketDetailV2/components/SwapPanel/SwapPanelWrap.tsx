import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  EInPageDialogType,
  Toast,
  useInPageDialog,
  useIsOverlayPage,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCustomRpcAvailability } from '@onekeyhq/kit/src/hooks/useCustomRpcAvailability';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { isOndoStockSource } from '@onekeyhq/kit/src/views/Market/components/utils/stockSource';
import type { ISwapReviewAdapter } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapNetworkFeeLevel,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import {
  EMarketPresetTradeSide,
  shouldShowMarketPresetReviewCustomNetworkFeeOption,
} from './hooks/marketPresetSettings';
import { useMarketPresetSettings } from './hooks/useMarketPresetSettings';
import { useSpeedSwapActions } from './hooks/useSpeedSwapActions';
import { useSpeedSwapInit } from './hooks/useSpeedSwapInit';
import { useSwapPanel } from './hooks/useSwapPanel';
import { ESwapDirection } from './hooks/useTradeType';
import { MarketSwapReviewDialog } from './MarketSwapReviewDialog';
import { SwapPanelContent } from './SwapPanelContent';

import type { IToken } from './types';

interface ISwapPanelWrapProps {
  onCloseDialog?: () => void;
}

export function SwapPanelWrap({ onCloseDialog }: ISwapPanelWrapProps) {
  const {
    networkId,
    tokenAddress,
    isNative: currentMarketTokenIsNative,
    tokenDetail,
    isReady,
  } = useTokenDetail();
  const intl = useIntl();
  const isModalPage = useIsOverlayPage();
  const inPageDialog = useInPageDialog(
    isModalPage ? EInPageDialogType.inModalPage : EInPageDialogType.inTabPages,
  );
  const swapPanel = useSwapPanel({
    networkId: networkId || 'evm--1',
  });
  const [hasInitialReady, setHasInitialReady] = useState(false);
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
    provider,
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
    let actionTranslationId;
    let actionToken: ISwapToken | undefined;
    let actionOtherToken: ISwapToken | undefined;
    if (!speedSwapEnabled) {
      actionTranslationId = onlySupportCrossChain
        ? ETranslations.promode_swap_unsupported_message_btc
        : ETranslations.promode_swap_unsupported_message_regular;
      actionToken = {
        networkId: networkId || '',
        contractAddress: tokenDetail?.address || '',
        symbol: tokenDetail?.symbol || '',
        decimals: tokenDetail?.decimals || 0,
        logoURI: tokenDetail?.logoUrl || '',
        isNative: !!tokenDetail?.isNative,
      };
      actionOtherToken = {
        networkId: paymentToken?.networkId || '',
        contractAddress: paymentToken?.contractAddress || '',
        symbol: paymentToken?.symbol || '',
        decimals: paymentToken?.decimals || 0,
        logoURI: paymentToken?.logoURI || '',
        isNative: paymentToken?.isNative || false,
      };
    }
    return {
      enabled: isEnabled,
      warningMessage,
      actionTranslationId,
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

  const effectiveSlippage = marketPresetSettings.enabled
    ? marketPresetSettings.selectedSlippageValue
    : slippage;
  const effectiveNetworkFeeLevel = marketPresetSettings.enabled
    ? marketPresetSettings.selectedNetworkFeeLevel
    : ESwapNetworkFeeLevel.MEDIUM;
  const effectiveCustomPriorityFee = marketPresetSettings.enabled
    ? marketPresetSettings.selectedPriorityFeeOverride
    : undefined;
  const useSpeedSwapActionsParams = {
    slippage: effectiveSlippage,
    spenderAddress: speedConfig.spenderAddress,
    marketToken: {
      networkId: networkId || '',
      contractAddress: tokenDetail?.address || '',
      symbol: tokenDetail?.symbol || '',
      decimals: tokenDetail?.decimals || 0,
      logoURI: tokenDetail?.logoUrl || '',
      price: tokenDetail?.priceConverted || tokenDetail?.price || '',
      isNative: !!tokenDetail?.isNative,
    },
    tradeToken: {
      networkId: paymentToken?.networkId || '',
      contractAddress: paymentToken?.contractAddress || '',
      symbol: paymentToken?.symbol || '',
      decimals: paymentToken?.decimals || 0,
      logoURI: paymentToken?.logoURI || '',
      price: paymentToken?.price || '',
      isNative: paymentToken?.isNative || false,
    },
    provider,
    tradeType: tradeType || ESwapDirection.BUY,
    fromTokenAmount:
      tradeType === ESwapDirection.BUY
        ? paymentAmount.toFixed()
        : sellAmount.toFixed(),
    antiMEV: swapMevNetConfig?.includes(swapPanel.networkId ?? ''),
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
    swapNativeTokenReserveGas,
    isWrapped,
    speedCheckError,
    speedCheckLoading,
    prepareMarketSwapReview,
    sendMarketApproveTx,
    sendMarketSwapTx,
    sendMarketWrappedTx,
    sendMarketSignMessage,
    buildMarketApproveInfos,
  } = speedSwapActions;

  const { result: mergeDeriveAssetsEnabled } = usePromiseResult(async () => {
    const result = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: balanceToken?.networkId || '',
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

  const filterDefaultTokens = useMemo(() => {
    if (defaultTokens?.length === 1) {
      return [...defaultTokens];
    }

    if (!currentMarketTokenForFilter) {
      return [...defaultTokens];
    }

    return defaultTokens.filter(
      (token) =>
        !equalTokenNoCaseSensitive({
          token1: token,
          token2: currentMarketTokenForFilter,
        }),
    );
  }, [currentMarketTokenForFilter, defaultTokens]);

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
    if (!marketPresetSettings.enabled) {
      return;
    }

    setSlippage(marketPresetSettings.selectedSlippageValue);
  }, [
    marketPresetSettings.enabled,
    marketPresetSettings.selectedSlippageValue,
    setSlippage,
  ]);

  useEffect(() => {
    if (marketPresetSettings.enabled || !speedConfig?.slippage) {
      return;
    }

    setSlippage(speedConfig.slippage);
  }, [marketPresetSettings.enabled, speedConfig?.slippage, setSlippage]);

  const reviewAdapter = useMemo<ISwapReviewAdapter>(
    () => ({
      prepareReview: prepareMarketSwapReview,
      sendApproveTx: sendMarketApproveTx,
      sendSwapTx: sendMarketSwapTx,
      sendWrappedTx: sendMarketWrappedTx,
      sendSignMessage: sendMarketSignMessage,
      buildApproveInfos: buildMarketApproveInfos,
    }),
    [
      buildMarketApproveInfos,
      prepareMarketSwapReview,
      sendMarketApproveTx,
      sendMarketSwapTx,
      sendMarketWrappedTx,
      sendMarketSignMessage,
    ],
  );

  const isActionLoading = useMemo(() => {
    return (
      speedSwapBuildTxLoading ||
      swapApprovingMatchLoading ||
      checkTokenAllowanceLoading ||
      speedCheckLoading
    );
  }, [
    checkTokenAllowanceLoading,
    speedCheckLoading,
    speedSwapBuildTxLoading,
    swapApprovingMatchLoading,
  ]);

  const openReviewDialog = useCallback(
    async (isWrap?: boolean) => {
      if (
        isActionLoading ||
        isReviewOpening ||
        marketPresetSettings.isLoading
      ) {
        return;
      }

      const requestId = reviewDialogRequestIdRef.current + 1;
      reviewDialogRequestIdRef.current = requestId;
      setIsReviewOpening(true);
      const showReviewCustomNetworkFeeOption =
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
            reviewDialogRef.current = null;
            setIsReviewDialogOpen(false);
          },
          renderContent: (
            <MarketSwapReviewDialog
              adapter={reviewAdapter}
              defaultNetworkFeeLevel={effectiveNetworkFeeLevel}
              defaultCustomPriorityFee={effectiveCustomPriorityFee}
              showCustomNetworkFeeOption={showReviewCustomNetworkFeeOption}
              reviewState={nextReviewState}
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
      marketPresetSettings,
      prepareMarketSwapReview,
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
      currentMarketToken={{
        networkId: networkId || '',
        contractAddress: tokenDetail?.address || '',
        symbol: tokenDetail?.symbol || '',
        decimals: tokenDetail?.decimals || 0,
        logoURI: tokenDetail?.logoUrl || '',
        isNative: !!tokenDetail?.isNative,
      }}
      onCloseDialog={onCloseDialog}
      priceRate={priceRate}
      swapMevNetConfig={swapMevNetConfig}
      swapNativeTokenReserveGas={swapNativeTokenReserveGas}
      swapPanel={swapPanelWithPreference}
      balance={balance ?? new BigNumber(0)}
      balanceToken={balanceToken as IToken}
      balanceLoading={fetchBalanceLoading}
      isLoading={isActionLoading || isReviewOpening}
      isActionDisabled={marketPresetSettings.isLoading}
      hasInitialReady={hasInitialReady}
      onSwap={handleSwap}
      slippageAutoValue={speedConfig?.slippage}
      supportSpeedSwap={supportSpeedSwap}
      defaultTokens={filterDefaultTokens}
      onWrappedSwap={handleWrappedSwap}
      isWrapped={isWrapped}
      speedCheckError={speedCheckError}
      disableNativeToken={disableNativeToken}
      marketPresetSettings={marketPresetSettings}
    />
  );
}
