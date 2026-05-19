import { memo, useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { DebugRenderTracker, YStack } from '@onekeyhq/components';
import {
  useTradingFormAtom,
  useTradingFormComputedAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsComputedAccountValueAtom,
  usePerpsCustomSettingsAtom,
  useTradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useOrderConfirm, useTradingPrice } from '../../hooks';
import { shouldApplyMinimumOrderGuard } from '../../utils/minimumOrderGuard';

import { showOrderConfirmDialog } from './modals/OrderConfirmModal';
import { PerpTradingForm } from './panels/PerpTradingForm';
import { PerpTradingButton } from './PerpTradingButton';
import { TradingButtonGroup } from './TradingButtonGroup';

function PerpTradingDisabledButton() {
  const intl = useIntl();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [formData] = useTradingFormAtom();
  const [tradingComputed] = useTradingFormComputedAtom();
  const { isSubmitting, handleConfirm } = useOrderConfirm();
  const { midPriceBN } = useTradingPrice();

  const [perpsCustomSettings] = usePerpsCustomSettingsAtom();
  const [tradingMode] = useTradingModeAtom();

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
    return midPriceBN;
  }, [formData.type, formData.price, midPriceBN]);

  const isMinimumOrderNotMet = useMemo(() => {
    if (
      !shouldApplyMinimumOrderGuard({
        isSpot: tradingMode === 'spot',
        orderMode: formData.orderMode,
        orderType: formData.type,
        hasBboPriceMode: Boolean(formData.bboPriceMode),
      })
    ) {
      return false;
    }
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
  }, [
    tradingComputed.computedSizeBN,
    effectivePriceBN,
    formData.bboPriceMode,
    formData.leverage,
    formData.orderMode,
    formData.type,
    tradingMode,
  ]);

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
      const withdrawableBN = new BigNumber(computedValue?.withdrawable || 0);
      const requiredMargin = tradingComputed.computedSizeBN
        .multipliedBy(effectivePriceBN)
        .dividedBy(safeLeverage);
      if (!requiredMargin.isFinite()) return false;
      return requiredMargin.gt(withdrawableBN);
    }
    return tradingComputed.computedSizeBN.gt(maxTradeSz);
  }, [
    computedValue?.withdrawable,
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
    showOrderConfirmDialog({ intl });
  }, [
    activeAssetData,
    perpsCustomSettings.skipOrderConfirm,
    handleConfirm,
    intl,
  ]);

  return (
    <PerpTradingButton
      loading={universalLoading}
      handleShowConfirm={handleShowConfirm}
      formData={formData}
      computedSize={tradingComputed.computedSizeBN}
      isMinimumOrderNotMet={isMinimumOrderNotMet}
      isSubmitting={isSubmitting}
      isNoEnoughMargin={isNoEnoughMargin}
    />
  );
}

const PerpTradingDisabledButtonMemo = memo(PerpTradingDisabledButton);

function PerpTradingPanel({ isMobile = false }: { isMobile?: boolean }) {
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [tradingMode] = useTradingModeAtom();
  const [isSubmitting] = useTradingLoadingAtom();

  const content = (
    <YStack
      gap={isMobile && tradingMode === 'spot' ? '$0.5' : '$2'}
      pl={isMobile ? undefined : '$3'}
      pr={isMobile ? undefined : '$5'}
      flex={isMobile ? 1 : undefined}
      justifyContent={
        isMobile && tradingMode !== 'spot' ? 'space-between' : undefined
      }
    >
      <PerpTradingForm isSubmitting={isSubmitting} isMobile={isMobile} />
      {perpsAccountStatus.canTrade ? (
        <TradingButtonGroup isMobile={isMobile} />
      ) : (
        <PerpTradingDisabledButtonMemo />
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
