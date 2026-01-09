import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { useSpeedSwapActions } from './hooks/useSpeedSwapActions';
import { useSpeedSwapInit } from './hooks/useSpeedSwapInit';
import { useSwapPanel } from './hooks/useSwapPanel';
import { ESwapDirection } from './hooks/useTradeType';
import { SwapPanelContent } from './SwapPanelContent';

import type { IToken } from './types';

interface ISwapPanelWrapProps {
  onCloseDialog?: () => void;
}

export function SwapPanelWrap({ onCloseDialog }: ISwapPanelWrapProps) {
  const { networkId, tokenDetail, isReady } = useTokenDetail();
  const intl = useIntl();
  const swapPanel = useSwapPanel({
    networkId: networkId || 'evm--1',
  });
  const [hasInitialReady, setHasInitialReady] = useState(false);

  const {
    setPaymentToken,
    paymentToken,
    paymentAmount,
    tradeType,
    setSlippage,
    slippage,
  } = swapPanel;

  const {
    isLoading: speedSwapInitLoading,
    speedConfig,
    supportSpeedSwap: originalSupportSpeedSwap,
    onlySupportCrossChain,
    defaultTokens,
    provider,
    swapMevNetConfig,
  } = useSpeedSwapInit(networkId || '', true);
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
    }
    return {
      enabled: isEnabled,
      warningMessage,
      actionTranslationId,
      actionToken,
    };
  }, [
    accountNetworkNotSupported,
    intl,
    networkId,
    onlySupportCrossChain,
    originalSupportSpeedSwap,
    tokenDetail?.address,
    tokenDetail?.decimals,
    tokenDetail?.isNative,
    tokenDetail?.logoUrl,
    tokenDetail?.supportSwap?.enable,
    tokenDetail?.supportSwap?.warningMessage,
    tokenDetail?.symbol,
  ]);

  const useSpeedSwapActionsParams = {
    slippage,
    spenderAddress: speedConfig.spenderAddress,
    marketToken: {
      networkId: networkId || '',
      contractAddress: tokenDetail?.address || '',
      symbol: tokenDetail?.symbol || '',
      decimals: tokenDetail?.decimals || 0,
      logoURI: tokenDetail?.logoUrl || '',
      price: tokenDetail?.price || '',
    },
    tradeToken: {
      networkId: paymentToken?.networkId || '',
      contractAddress: paymentToken?.contractAddress || '',
      symbol: paymentToken?.symbol || '',
      decimals: paymentToken?.decimals || 0,
      logoURI: paymentToken?.logoURI || '',
      isNative: paymentToken?.isNative || false,
    },
    defaultTradeTokens: defaultTokens,
    provider,
    tradeType: tradeType || ESwapDirection.BUY,
    fromTokenAmount: paymentAmount.toFixed(),
    antiMEV: swapMevNetConfig?.includes(swapPanel.networkId ?? ''),
    onCloseDialog,
  };

  const speedSwapActions = useSpeedSwapActions(useSpeedSwapActionsParams);

  const {
    speedSwapBuildTx,
    speedSwapWrappedTx,
    speedSwapBuildTxLoading,
    checkTokenAllowanceLoading,
    speedSwapApproveHandler,
    speedSwapApproveActionLoading,
    speedSwapApproveTransactionLoading,
    shouldApprove,
    balance,
    balanceToken,
    fetchBalanceLoading,
    priceRate,
    swapNativeTokenReserveGas,
    isWrapped,
  } = speedSwapActions;

  const filterDefaultTokens = useMemo(() => {
    if (defaultTokens?.length === 1) {
      return [...defaultTokens];
    }
    return defaultTokens.filter(
      (token) =>
        !equalTokenNoCaseSensitive({
          token1: token,
          token2: {
            networkId: networkId || '',
            contractAddress: tokenDetail?.address || '',
          },
        }),
    );
  }, [defaultTokens, networkId, tokenDetail]);

  useEffect(() => {
    if (filterDefaultTokens.length > 0 && !paymentToken?.networkId) {
      setPaymentToken(filterDefaultTokens[0]);
      return;
    }
    if (
      filterDefaultTokens.length > 0 &&
      filterDefaultTokens.every(
        (token) =>
          token.networkId !== paymentToken?.networkId ||
          token.contractAddress !== paymentToken?.contractAddress,
      )
    ) {
      setPaymentToken(filterDefaultTokens[0]);
    }
  }, [
    paymentToken?.networkId,
    paymentToken?.contractAddress,
    setPaymentToken,
    filterDefaultTokens,
  ]);

  useEffect(() => {
    if (speedConfig?.slippage) {
      setSlippage(speedConfig.slippage);
    }
  }, [speedConfig?.slippage, setSlippage]);

  const handleApprove = useCallback(() => {
    void speedSwapApproveHandler();
  }, [speedSwapApproveHandler]);

  const handleSwap = useCallback(() => {
    void speedSwapBuildTx();
  }, [speedSwapBuildTx]);

  const handleWrappedSwap = useCallback(() => {
    void speedSwapWrappedTx();
  }, [speedSwapWrappedTx]);

  useEffect(() => {
    return () => {
      dismissKeyboard();
    };
  }, []);

  const isActionLoading = useMemo(() => {
    return (
      speedSwapApproveActionLoading ||
      speedSwapApproveTransactionLoading ||
      speedSwapBuildTxLoading ||
      checkTokenAllowanceLoading
    );
  }, [
    speedSwapApproveActionLoading,
    speedSwapApproveTransactionLoading,
    speedSwapBuildTxLoading,
    checkTokenAllowanceLoading,
  ]);

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

  return (
    <SwapPanelContent
      onCloseDialog={onCloseDialog}
      priceRate={priceRate}
      swapMevNetConfig={swapMevNetConfig}
      swapNativeTokenReserveGas={swapNativeTokenReserveGas}
      swapPanel={swapPanel}
      balance={balance ?? new BigNumber(0)}
      balanceToken={balanceToken as IToken}
      balanceLoading={fetchBalanceLoading}
      isLoading={isActionLoading}
      hasInitialReady={hasInitialReady}
      onSwap={handleSwap}
      isApproved={!shouldApprove}
      slippageAutoValue={speedConfig?.slippage}
      supportSpeedSwap={supportSpeedSwap}
      defaultTokens={filterDefaultTokens}
      onApprove={handleApprove}
      onWrappedSwap={handleWrappedSwap}
      isWrapped={isWrapped}
    />
  );
}
