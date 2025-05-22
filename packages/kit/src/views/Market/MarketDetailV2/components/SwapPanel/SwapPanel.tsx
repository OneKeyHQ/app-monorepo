/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useSpeedSwapActions } from './hooks/useSpeedSwapActions';
import { useSpeedSwapInit } from './hooks/useSpeedSwapInit';
import { useSwapPanel } from './hooks/useSwapPanel';
import { SwapPanelContent } from './SwapPanelContent';

export type ISwapPanelProps = {
  networkId?: string;
};

export function SwapPanel(props: ISwapPanelProps) {
  const { networkId: networkIdProp } = props;
  const intl = useIntl();
  const media = useMedia();

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

  const swapPanelContent = (
    <SwapPanelContent
      swapPanel={swapPanel}
      isLoading={isLoading}
      slippageAutoValue={speedConfig?.slippage}
      supportSpeedSwap={supportSpeedSwap}
      defaultTokens={defaultTokens}
      onApprove={handleApprove}
    />
  );

  const showSwapDialog = () => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_swap }),
      renderContent: swapPanelContent,
      showFooter: false,
    });
  };

  if (media.md) {
    return (
      <Button onPress={showSwapDialog}>
        {intl.formatMessage({ id: ETranslations.global_swap })}
      </Button>
    );
  }

  return swapPanelContent;
}
