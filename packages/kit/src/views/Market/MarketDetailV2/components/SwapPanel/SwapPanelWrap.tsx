import { act, useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

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
  const { networkId, tokenDetail } = useTokenDetail();
  const intl = useIntl();
  const swapPanel = useSwapPanel({
    networkId: networkId || 'evm--1',
  });

  const {
    setPaymentToken,
    paymentToken,
    paymentAmount,
    tradeType,
    setSlippage,
    slippage,
  } = swapPanel;

  const {
    isLoading,
    speedConfig,
    supportSpeedSwap: originalSupportSpeedSwap,
    defaultTokens,
    provider,
    swapMevNetConfig,
  } = useSpeedSwapInit(networkId || '');

  const { activeAccount } = useActiveAccount({ num: 0 });

  const checkAccountNetworkSupport = useCallback(() => {
    if (
      accountUtils.isImportedAccount({
        accountId: activeAccount?.account?.id ?? '',
      }) ||
      accountUtils.isWatchingAccount({
        accountId: activeAccount?.account?.id ?? '',
      }) ||
      accountUtils.isExternalAccount({
        accountId: activeAccount?.account?.id ?? '',
      })
    ) {
      const { impl } = networkUtils.parseNetworkId({
        networkId: activeAccount?.network?.id ?? '',
      });
      const { impl: networkImpl } = networkUtils.parseNetworkId({
        networkId: networkId ?? '',
      });
      return impl === networkImpl;
    }
    return true;
  }, [activeAccount?.account?.id, activeAccount?.network?.id, networkId]);

  const supportSpeedSwap = useMemo(() => {
    const speedSwapEnabled = originalSupportSpeedSwap;
    const tokenSwapEnabled = tokenDetail?.supportSwap?.enable !== false;
    const isEnabled =
      speedSwapEnabled && tokenSwapEnabled && checkAccountNetworkSupport();

    let warningMessage = !tokenSwapEnabled
      ? tokenDetail?.supportSwap?.warningMessage
      : undefined;
    if (!checkAccountNetworkSupport() && !warningMessage) {
      warningMessage = intl.formatMessage({
        id: ETranslations.swap_page_alert_account_does_not_support_swap,
      });
    }
    return {
      enabled: isEnabled,
      warningMessage,
    };
  }, [
    intl,
    checkAccountNetworkSupport,
    originalSupportSpeedSwap,
    tokenDetail?.supportSwap?.enable,
    tokenDetail?.supportSwap?.warningMessage,
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
    speedSwapApproveLoading,
    shouldApprove,
    balance,
    balanceToken,
    fetchBalanceLoading,
    priceRate,
    swapNativeTokenReserveGas,
    isWrapped,
  } = speedSwapActions;

  const filterDefaultTokens = useMemo(() => {
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
    if (filterDefaultTokens.length > 0 && !paymentToken) {
      setPaymentToken(filterDefaultTokens[0]);
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
  }, [paymentToken, setPaymentToken, filterDefaultTokens]);

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

  return (
    <SwapPanelContent
      priceRate={priceRate}
      swapMevNetConfig={swapMevNetConfig}
      swapNativeTokenReserveGas={swapNativeTokenReserveGas}
      swapPanel={swapPanel}
      balance={balance ?? new BigNumber(0)}
      balanceToken={balanceToken as IToken}
      balanceLoading={fetchBalanceLoading}
      isLoading={
        isLoading ||
        speedSwapApproveLoading ||
        speedSwapBuildTxLoading ||
        checkTokenAllowanceLoading
      }
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
