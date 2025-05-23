/* eslint-disable @typescript-eslint/no-unused-vars */

import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, useMedia } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { useSpeedSwapActions } from './hooks/useSpeedSwapActions';
import { useSpeedSwapInit } from './hooks/useSpeedSwapInit';
import { useSwapPanel } from './hooks/useSwapPanel';
import { ESwapDirection, type ITradeType } from './hooks/useTradeType';
import { SwapPanelContent } from './SwapPanelContent';

export type ISwapPanelProps = {
  networkId?: string;
  tokenDetail?: IMarketTokenDetail;
};

export function SwapPanel(props: ISwapPanelProps) {
  const { networkId: networkIdProp, tokenDetail } = props;
  const intl = useIntl();
  const media = useMedia();
  const { activeAccount } = useActiveAccount({ num: 0 });
  console.log('swap__activeAccount--', activeAccount);
  const swapPanel = useSwapPanel({
    networkId: networkIdProp ?? 'evm--1',
  });

  const {
    networkId,
    setPaymentToken,
    paymentToken,
    paymentAmount,
    setTradeType,
    tradeType,
    setSlippage,
    slippage,
  } = swapPanel;

  const { isLoading, speedConfig, supportSpeedSwap, defaultTokens, provider } =
    useSpeedSwapInit(networkIdProp ?? '');

  const {
    speedSwapBuildTx,
    speedSwapBuildTxLoading,
    checkTokenAllowanceLoading,
    speedSwapApproveHandler,
    speedSwapApproveLoading,
    shouldApprove,
  } = useSpeedSwapActions({
    slippage,
    spenderAddress: speedConfig.spenderAddress,
    token: {
      networkId: networkId ?? '',
      contractAddress: tokenDetail?.address ?? '',
      symbol: tokenDetail?.symbol ?? '',
      decimals: tokenDetail?.decimals ?? 0,
      logoURI: tokenDetail?.logoUrl ?? '',
      isNative: !tokenDetail?.address,
    },
    tradeToken: {
      networkId: networkId ?? '',
      contractAddress: paymentToken?.contractAddress ?? '',
      symbol: paymentToken?.symbol ?? '',
      decimals: paymentToken?.decimals ?? 0,
      logoURI: paymentToken?.logoURI ?? '',
      isNative: paymentToken?.isNative ?? false,
    },
    provider,
    tradeType: tradeType ?? ESwapDirection.BUY,
    accountId: activeAccount.account?.indexedAccountId,
    fromTokenAmount: paymentAmount.toFixed(),
  });
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
      swapPanel={swapPanel}
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
      <>
        <Button onPress={() => showSwapDialog(ESwapDirection.BUY)} mr="$2.5">
          {intl.formatMessage({ id: ETranslations.global_buy })}
        </Button>
        <Button
          onPress={() => showSwapDialog(ESwapDirection.SELL)}
          variant="secondary"
        >
          {intl.formatMessage({ id: ETranslations.global_sell })}
        </Button>
      </>
    );
  }

  return swapPanelContent;
}
