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
  usePerpsActiveAccountEnableTradingModeAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsComputedAccountValueAtom,
  usePerpsCustomSettingsAtom,
  useTradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useOrderConfirm } from '../../hooks';
import { useOrderPrice } from '../../hooks/useOrderPrice';
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
  const { price: effectivePriceBN } = useOrderPrice(formData.side);

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

    const orderValue = tradingComputed.computedSizeBN.multipliedBy(priceBN);
    return orderValue.lt(10);
  }, [
    tradingComputed.computedSizeBN,
    effectivePriceBN,
    formData.bboPriceMode,
    formData.orderMode,
    formData.type,
    tradingMode,
  ]);

  const isNoEnoughMargin = useMemo(() => {
    if (
      (formData.orderMode === 'scale' && formData.scaleReduceOnly) ||
      (formData.orderMode === 'twap' && formData.twapReduceOnly)
    ) {
      return false;
    }
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
    formData.orderMode,
    formData.scaleReduceOnly,
    formData.twapReduceOnly,
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
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [enableTradingMode] = usePerpsActiveAccountEnableTradingModeAtom();
  const [tradingMode] = useTradingModeAtom();
  const [isSubmitting] = useTradingLoadingAtom();

  const canShowTradingButtons = useMemo(
    () =>
      !perpsAccountLoading.selectAccountLoading &&
      Boolean(perpsAccountStatus.accountAddress) &&
      !perpsAccountStatus.accountNotSupport &&
      !perpsAccountStatus.canCreateAddress &&
      (Boolean(perpsAccountStatus.canTrade) ||
        enableTradingMode.isSoftwareAccount),
    [
      enableTradingMode.isSoftwareAccount,
      perpsAccountLoading.selectAccountLoading,
      perpsAccountStatus.accountAddress,
      perpsAccountStatus.accountNotSupport,
      perpsAccountStatus.canCreateAddress,
      perpsAccountStatus.canTrade,
    ],
  );

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
      {canShowTradingButtons ? (
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
