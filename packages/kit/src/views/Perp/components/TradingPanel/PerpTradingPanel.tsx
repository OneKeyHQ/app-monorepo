import { memo, useCallback, useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import { useTradingFormAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  useCurrentTokenData,
  useHyperliquidAccount,
  useHyperliquidTrading,
  useOrderConfirm,
} from '../../hooks';

import { showOrderConfirmDialog } from './modals/OrderConfirmModal';
import { PerpTradingForm } from './panels/PerpTradingForm';
import { PerpTradingButton } from './PerpTradingButton';

function PerpTradingPanel() {
  const { loading } = useHyperliquidTrading();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const hlAccount = useHyperliquidAccount();
  const tokenInfo = useCurrentTokenData();
  const [formData] = useTradingFormAtom();
  const { isSubmitting, handleConfirm } = useOrderConfirm();

  const [perpsCustomSettings] = usePerpsCustomSettingsAtom();

  const universalLoading = useMemo(() => {
    return perpsAccountLoading?.selectAccountLoading || loading;
  }, [perpsAccountLoading?.selectAccountLoading, loading]);

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
        +(hlAccount?.accountSummary?.withdrawable || 0)
      );
    }
    return +formData.size > maxTradeSz;
  }, [
    hlAccount?.accountSummary?.withdrawable,
    formData.size,
    maxTradeSz,
    formData.type,
    formData.price,
    leverage,
  ]);

  const handleShowConfirm = useCallback(() => {
    if (!tokenInfo) {
      console.error(
        '[PerpTradingPanel.handleShowConfirm] No token info available',
      );
      return;
    }
    if (perpsCustomSettings.skipOrderConfirm) {
      void handleConfirm();
      return;
    }
    showOrderConfirmDialog();
  }, [tokenInfo, perpsCustomSettings.skipOrderConfirm, handleConfirm]);

  return (
    <YStack gap="$4" p="$4">
      <PerpTradingForm isSubmitting={isSubmitting} />
      <PerpTradingButton
        loading={universalLoading}
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
