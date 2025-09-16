import { memo, useCallback, useMemo } from 'react';

import { Button, SizableText, Spinner, YStack } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useTradingFormAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsAccountLoadingAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  useCurrentTokenData,
  useHyperliquidAccount,
  useHyperliquidTrading,
} from '../../hooks';

import { showOrderConfirmDialog } from './modals/OrderConfirmModal';
import { PerpTradingForm } from './panels/PerpTradingForm';
import { PerpTradingButton } from './PerpTradingButton';

function PerpTradingPanel() {
  const { canTrade, loading, currentUser, checkAndApproveWallet } =
    useHyperliquidTrading();
  const [perpsAccountLoading] = usePerpsAccountLoadingAtom();
  const { userWebData2, accountSummary } = useHyperliquidAccount();
  const tokenInfo = useCurrentTokenData();
  const [formData] = useTradingFormAtom();
  const [isSubmitting] = useTradingLoadingAtom();

  const universalLoading = useMemo(() => {
    return perpsAccountLoading || loading;
  }, [perpsAccountLoading, loading]);

  const leverage = useMemo(() => {
    return tokenInfo?.leverage?.value || tokenInfo?.maxLeverage || 1;
  }, [tokenInfo]);

  const maxTradeSz = useMemo(() => {
    const maxTradeSzs = tokenInfo?.maxTradeSzs || [0, 0];
    return maxTradeSzs[formData.side === 'long' ? 0 : 1];
  }, [tokenInfo?.maxTradeSzs, formData.side]);

  const isNoEnoughMargin = useMemo(() => {
    if (formData.type === 'limit') {
      return (
        (+formData.price * +formData.size) / leverage >
        +(accountSummary?.withdrawable || 0)
      );
    }
    return +formData.size > maxTradeSz;
  }, [
    formData.size,
    maxTradeSz,
    formData.type,
    accountSummary?.withdrawable,
    formData.price,
    leverage,
  ]);

  const actions = useHyperliquidActions();
  const handleShowConfirm = useCallback(() => {
    if (!tokenInfo) {
      console.error(
        '[PerpTradingPanel.handleShowConfirm] No token info available',
      );
      return;
    }
    const liquidationPrice = '';

    showOrderConfirmDialog({
      formData,
      tokenName: tokenInfo.name,
      liquidationPrice,
      onConfirm: async () => {
        try {
          if (formData.type === 'market') {
            await actions.current.orderOpen({
              assetId: tokenInfo.assetId,
              formData,
              midPx: tokenInfo.markPx || '0',
            });
          } else {
            await actions.current.placeOrder({
              assetId: tokenInfo.assetId,
              formData,
            });
          }

          // Reset form after successful order
          actions.current.resetTradingForm();
        } catch (error) {
          console.error(
            '[PerpTradingPanel.handleConfirm] Failed to place order:',
            error,
          );
          throw error;
        }
      },
    });
  }, [tokenInfo, formData, actions]);

  return (
    <YStack gap="$2" p="$4">
      <PerpTradingForm isSubmitting={isSubmitting} />
      <PerpTradingButton
        userWebData2={userWebData2}
        loading={universalLoading}
        canTrade={canTrade}
        checkAndApproveWallet={checkAndApproveWallet}
        handleShowConfirm={handleShowConfirm}
        formData={formData}
        isSubmitting={isSubmitting}
        isNoEnoughMargin={isNoEnoughMargin}
      />
    </YStack>
  );
}

const PerpTradingPanelMemo = memo(PerpTradingPanel);
export { PerpTradingPanelMemo as PerpTradingPanel };
