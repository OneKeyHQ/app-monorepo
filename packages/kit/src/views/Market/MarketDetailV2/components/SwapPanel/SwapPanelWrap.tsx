import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, Dialog, useMedia } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { useSpeedSwapActions } from './hooks/useSpeedSwapActions';
import { useSpeedSwapInit } from './hooks/useSpeedSwapInit';
import { useSwapPanel } from './hooks/useSwapPanel';
import { ESwapDirection, type ITradeType } from './hooks/useTradeType';
import { SwapPanelContent } from './SwapPanelContent';

import type { IToken } from './types';

export function SwapPanelWrap() {
  const intl = useIntl();
  const media = useMedia();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { networkId, tokenDetail } = useTokenDetail();

  const swapPanel = useSwapPanel({
    networkId: networkId || 'evm--1',
  });

  const {
    setPaymentToken,
    paymentToken,
    paymentAmount,
    setTradeType,
    tradeType,
    setSlippage,
    slippage,
  } = swapPanel;

  const {
    isLoading,
    speedConfig,
    supportSpeedSwap,
    defaultTokens,
    provider,
    swapMevNetConfig,
  } = useSpeedSwapInit(networkId || '');

  const useSpeedSwapActionsParams = {
    slippage,
    spenderAddress: speedConfig.spenderAddress,
    marketToken: {
      networkId: networkId || '',
      contractAddress: tokenDetail?.address || '',
      symbol: tokenDetail?.symbol || '',
      decimals: tokenDetail?.decimals || 0,
      logoURI: tokenDetail?.logoUrl || '',
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
    account: activeAccount,
    fromTokenAmount: paymentAmount.toFixed(),
    antiMEV: swapPanel.antiMEV,
  };

  const speedSwapActions = useSpeedSwapActions(useSpeedSwapActionsParams);

  const {
    speedSwapBuildTx,
    speedSwapBuildTxLoading,
    checkTokenAllowanceLoading,
    speedSwapApproveHandler,
    speedSwapApproveLoading,
    shouldApprove,
    balance,
    balanceToken,
    fetchBalanceLoading,
  } = speedSwapActions;

  useEffect(() => {
    if (defaultTokens.length > 0 && !paymentToken) {
      setPaymentToken(defaultTokens[0]);
    }
  }, [defaultTokens, paymentToken, setPaymentToken]);

  useEffect(() => {
    if (speedConfig?.slippage) {
      setSlippage(speedConfig.slippage);
    }
  }, [speedConfig?.slippage, setSlippage]);

  const dialogRef = useRef<ReturnType<typeof Dialog.show>>();

  useEffect(() => {
    if (!media.md) {
      void dialogRef.current?.close();
    }
  }, [media.md]);

  const handleApprove = useCallback(() => {
    void speedSwapApproveHandler();
  }, [speedSwapApproveHandler]);

  const handleSwap = useCallback(() => {
    void speedSwapBuildTx();
  }, [speedSwapBuildTx]);

  const swapPanelContent = (
    <SwapPanelContent
      swapMevNetConfig={swapMevNetConfig}
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
      defaultTokens={defaultTokens}
      onApprove={handleApprove}
    />
  );

  const showSwapDialog = (tradeTypeValue: ITradeType) => {
    setTradeType(tradeTypeValue);

    dialogRef.current = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_swap }),
      renderContent: swapPanelContent,
      showFooter: false,
    });
  };

  if (media.md) {
    return (
      <Button
        variant="primary"
        onPress={() => showSwapDialog(ESwapDirection.BUY)}
      >
        {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
      </Button>
    );
  }

  return <>{swapPanelContent}</>;
}
