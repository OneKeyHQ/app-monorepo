import { memo, useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import { DebugRenderTracker, YStack } from '@onekeyhq/components';
import {
  useTradingFormAtom,
  useTradingFormComputedAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useOrderConfirm } from '../../hooks';

import { showOrderConfirmDialog } from './modals/OrderConfirmModal';
import { PerpTradingForm } from './panels/PerpTradingForm';
import { PerpTradingButton } from './PerpTradingButton';
import { TradingButtonGroup } from './TradingButtonGroup';

function PerpTradingPanel({ isMobile = false }: { isMobile?: boolean }) {
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [formData] = useTradingFormAtom();
  const [tradingComputed] = useTradingFormComputedAtom();
  const { isSubmitting, handleConfirm } = useOrderConfirm();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();

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

  const effectivePriceBN = useMemo(() => {
    if (formData.type === 'limit') {
      return new BigNumber(formData.price || 0);
    }
    return new BigNumber(activeAssetCtx?.ctx?.markPrice || 0);
  }, [formData.type, formData.price, activeAssetCtx?.ctx?.markPrice]);

  const isMinimumOrderNotMet = useMemo(() => {
    if (!tradingComputed.computedSizeBN.isFinite()) return false;
    if (tradingComputed.computedSizeBN.lte(0)) return false;

    const priceBN = effectivePriceBN;
    if (!priceBN.isFinite() || priceBN.lte(0)) return false;

    const leverageBN = new BigNumber(formData.leverage || 1);
    if (!leverageBN.isFinite() || leverageBN.lte(0)) return false;

    const orderValue = tradingComputed.computedSizeBN
      .multipliedBy(priceBN)
      .multipliedBy(leverageBN);
    return orderValue.lt(10);
  }, [tradingComputed.computedSizeBN, effectivePriceBN, formData.leverage]);

  const isNoEnoughMargin = useMemo(() => {
    if (!tradingComputed.computedSizeBN.isFinite()) return false;
    if (tradingComputed.computedSizeBN.lte(0)) return false;

    if (formData.type === 'limit') {
      if (!effectivePriceBN.isFinite() || effectivePriceBN.lte(0)) {
        return false;
      }
      const leverageBN = new BigNumber(leverage || 1);
      const safeLeverage =
        leverageBN.isFinite() && leverageBN.gt(0)
          ? leverageBN
          : new BigNumber(1);
      const withdrawableBN = new BigNumber(accountSummary?.withdrawable || 0);
      const requiredMargin = tradingComputed.computedSizeBN
        .multipliedBy(effectivePriceBN)
        .dividedBy(safeLeverage);
      if (!requiredMargin.isFinite()) return false;
      return requiredMargin.gt(withdrawableBN);
    }
    return tradingComputed.computedSizeBN.gt(maxTradeSz);
  }, [
    accountSummary?.withdrawable,
    tradingComputed.computedSizeBN,
    maxTradeSz,
    formData.type,
    effectivePriceBN,
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

  const content = (
    <YStack
      gap="$2"
      pt={isMobile ? undefined : '$3'}
      px={isMobile ? undefined : '$2.5'}
      flex={isMobile ? 1 : undefined}
      justifyContent={isMobile ? 'space-between' : undefined}
    >
      <PerpTradingForm isSubmitting={isSubmitting} isMobile={isMobile} />
      {perpsAccountStatus.canTrade ? (
        <TradingButtonGroup isMobile={isMobile} />
      ) : (
        <PerpTradingButton
          loading={universalLoading}
          handleShowConfirm={handleShowConfirm}
          formData={formData}
          computedSize={tradingComputed.computedSizeBN}
          isMinimumOrderNotMet={isMinimumOrderNotMet}
          isSubmitting={isSubmitting}
          isNoEnoughMargin={isNoEnoughMargin}
        />
      )}
    </YStack>
  );
  return (
    <DebugRenderTracker name="PerpTradingPanel" position="top-right">
      {content}
    </DebugRenderTracker>
  );
}

const PerpTradingPanelMemo = memo(PerpTradingPanel);
export { PerpTradingPanelMemo as PerpTradingPanel };
