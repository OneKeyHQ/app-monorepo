import { memo, useCallback, useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import { useTradingFormAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useOrderConfirm } from '../../hooks';

import { showOrderConfirmDialog } from './modals/OrderConfirmModal';
import { PerpTradingForm } from './panels/PerpTradingForm';
import { PerpTradingButton } from './PerpTradingButton';

function PerpTradingPanel({ isMobile = false }: { isMobile?: boolean }) {
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [formData] = useTradingFormAtom();
  const { isSubmitting, handleConfirm } = useOrderConfirm();

  const [perpsCustomSettings] = usePerpsCustomSettingsAtom();

  const universalLoading = useMemo(() => {
    return perpsAccountLoading?.selectAccountLoading;
  }, [perpsAccountLoading?.selectAccountLoading]);

  const leverage = useMemo(() => {
    return activeAssetData?.leverage?.value || 1;
  }, [activeAssetData?.leverage?.value]);

  const maxTradeSz = useMemo(() => {
    const maxTradeSzs = activeAssetData?.maxTradeSzs || [0, 0];
    return Number(maxTradeSzs[formData.side === 'long' ? 0 : 1]);
  }, [activeAssetData?.maxTradeSzs, formData.side]);

  const isNoEnoughMargin = useMemo(() => {
    if (formData.type === 'limit') {
      return (
        (+formData.price * +formData.size) / leverage >
        +(accountSummary?.withdrawable || 0)
      );
    }
    return +formData.size > maxTradeSz;
  }, [
    accountSummary?.withdrawable,
    formData.size,
    maxTradeSz,
    formData.type,
    formData.price,
    leverage,
  ]);

  const handleShowConfirm = useCallback(() => {
    if (!activeAssetData) {
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
  }, [activeAssetData, perpsCustomSettings.skipOrderConfirm, handleConfirm]);

  return (
    <YStack gap="$4" pt="$3" px="$2.5">
      <PerpTradingForm isSubmitting={isSubmitting} isMobile={isMobile} />
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
