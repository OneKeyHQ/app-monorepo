import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, Dialog, useMedia } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { SwapTestPanel } from './components/SwapTestPanel';
import { useSpeedSwapActions } from './hooks/useSpeedSwapActions';
import { useSpeedSwapInit } from './hooks/useSpeedSwapInit';
import { useSwapPanel } from './hooks/useSwapPanel';
import { ESwapDirection, type ITradeType } from './hooks/useTradeType';
import { SwapPanelContent } from './SwapPanelContent';

import type { IToken } from './types';

export type ISwapPanelProps = {
  networkId?: string;
  tokenDetail?: IMarketTokenDetail;
};

export function SwapPanel(props: ISwapPanelProps) {
  const { networkId: networkIdProp, tokenDetail } = props;

  console.log('networkIdProp, tokenDetail', networkIdProp, tokenDetail);
  const intl = useIntl();
  const media = useMedia();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const swapPanel = useSwapPanel({
    networkId: networkIdProp ?? 'evm--1',
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

  const { isLoading, speedConfig, supportSpeedSwap, defaultTokens, provider } =
    useSpeedSwapInit(networkIdProp ?? '');

  const useSpeedSwapActionsParams = {
    slippage,
    spenderAddress: speedConfig.spenderAddress,
    marketToken: {
      networkId: networkIdProp ?? '',
      contractAddress: tokenDetail?.address ?? '',
      symbol: tokenDetail?.symbol ?? '',
      decimals: tokenDetail?.decimals ?? 0,
      logoURI: tokenDetail?.logoUrl ?? '',
    },
    tradeToken: {
      networkId: paymentToken?.networkId ?? '',
      contractAddress: paymentToken?.contractAddress ?? '',
      symbol: paymentToken?.symbol ?? '',
      decimals: paymentToken?.decimals ?? 0,
      logoURI: paymentToken?.logoURI ?? '',
      isNative: paymentToken?.isNative ?? false,
    },
    defaultTradeTokens: defaultTokens,
    provider,
    tradeType: tradeType ?? ESwapDirection.BUY,
    account: activeAccount,
    fromTokenAmount: paymentAmount.toFixed(),
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
      swapPanel={swapPanel}
      balance={balance ?? new BigNumber(0)}
      balanceToken={balanceToken as IToken}
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

  return (
    <>
      {swapPanelContent}

      {/* Test - Only in Dev Mode */}
      {platformEnv.isDev ? (
        <SwapTestPanel
          useSpeedSwapActionsParams={useSpeedSwapActionsParams}
          speedSwapActions={speedSwapActions}
          swapPanel={swapPanel}
        />
      ) : null}
    </>
  );
}
