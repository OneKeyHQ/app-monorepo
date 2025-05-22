/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect } from 'react';

import { useSpeedSwapActions } from './hooks/useSpeedSwapActions';
import { useSpeedSwapInit } from './hooks/useSpeedSwapInit';
import { useSwapPanel } from './hooks/useSwapPanel';
import { SwapPanelContent } from './SwapPanelContent';

export type ISwapPanelProps = {
  networkId?: string;
};

export function SwapPanel(props: ISwapPanelProps) {
  const { networkId: networkIdProp } = props;
  const swapPanel = useSwapPanel({
    networkId: networkIdProp ?? 'evm--1',
  });

  const { networkId, setIsApproved, setPaymentToken, paymentToken } = swapPanel;

  const { isLoading, speedConfig, supportSpeedSwap, defaultTokens } =
    useSpeedSwapInit(networkId ?? '');

  const {
    speedSwapBuildTx,
    speedSwapBuildTxLoading,
    checkTokenApproveAllowance,
    checkTokenAllowanceLoading,
    speedSwapApproveHandler,
    speedSwapApproveLoading,
  } = useSpeedSwapActions({
    token: {
      networkId: networkId ?? '',
      contractAddress: '',
      symbol: '',
      decimals: 0,
      logoURI: '',
    },
    accountId: '',
  });

  useEffect(() => {
    if (defaultTokens.length > 0 && !paymentToken) {
      setPaymentToken(defaultTokens[0]);
    }
  }, [defaultTokens, paymentToken, setPaymentToken]);

  const handleApprove = () => {
    setIsApproved(true);
  };

  return (
    <SwapPanelContent
      swapPanel={swapPanel}
      isLoading={isLoading}
      slippageAutoValue={speedConfig?.slippage}
      supportSpeedSwap={supportSpeedSwap}
      defaultTokens={defaultTokens}
      onApprove={handleApprove}
    />
  );
}
