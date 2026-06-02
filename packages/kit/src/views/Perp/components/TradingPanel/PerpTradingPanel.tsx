import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { DebugRenderTracker, YStack } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useTradingFormAtom,
  useTradingFormComputedAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  getPerpsAccountDisplaySnapshotEntry,
  usePerpsAccountDisplayReadyAtom,
  usePerpsAccountDisplaySnapshotAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountEnableTradingModeAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsComputedAccountValueAtom,
  usePerpsCustomSettingsAtom,
  useTradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useOrderConfirm } from '../../hooks';
import { useOrderPrice } from '../../hooks/useOrderPrice';
import { getPerpsFormLeverage } from '../../utils/leverageDisplay';
import { shouldApplyMinimumOrderGuard } from '../../utils/minimumOrderGuard';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../../utils/mobileLayoutTrace';
import {
  getPerpsOrderPanelEnableTradingModeByAccount,
  shouldReservePerpsMobileEnableTradingLayout,
  shouldShowPerpsOrderPanelTradingButtons,
} from '../../utils/perpsOrderPanelEnableTrading';

import { showOrderConfirmDialog } from './modals/OrderConfirmModal';
import { PerpTradingForm } from './panels/PerpTradingForm';
import { PerpTradingButton } from './PerpTradingButton';
import { TradingButtonGroup } from './TradingButtonGroup';

import type { LayoutChangeEvent } from 'react-native';

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
    return (
      getPerpsFormLeverage({
        isSpot: tradingMode === 'spot',
        liveLeverage: formData.leverage ?? activeAssetData?.leverage?.value,
      }) ?? 1
    );
  }, [activeAssetData?.leverage?.value, formData.leverage, tradingMode]);

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
  const [displayReady] = usePerpsAccountDisplayReadyAtom();
  const [perpsActiveAccount] = usePerpsActiveAccountAtom();
  const [displaySnapshot] = usePerpsAccountDisplaySnapshotAtom();
  const { activeAccount: selectedWalletAccount } = useActiveAccount({ num: 0 });
  const [enableTradingMode] = usePerpsActiveAccountEnableTradingModeAtom();
  const [tradingMode] = useTradingModeAtom();
  const [isSubmitting] = useTradingLoadingAtom();
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  const snapshotLookupIndexedAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.indexedAccount?.id
    : perpsActiveAccount?.indexedAccountId;
  const snapshotLookupAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.account?.id
    : perpsActiveAccount?.accountId;
  const snapshotLookupAccountAddress =
    !selectedWalletAccount.ready ||
    snapshotLookupIndexedAccountId ||
    snapshotLookupAccountId
      ? perpsActiveAccount?.accountAddress
      : undefined;
  const snapshotEntry = useMemo(
    () =>
      getPerpsAccountDisplaySnapshotEntry({
        snapshot: displaySnapshot,
        accountAddress: snapshotLookupAccountAddress,
        indexedAccountId: snapshotLookupIndexedAccountId,
        accountId: snapshotLookupAccountId,
        deriveType:
          selectedWalletAccount.deriveType ?? perpsActiveAccount.deriveType,
      }),
    [
      displaySnapshot,
      perpsActiveAccount?.deriveType,
      selectedWalletAccount.deriveType,
      snapshotLookupAccountAddress,
      snapshotLookupAccountId,
      snapshotLookupIndexedAccountId,
    ],
  );
  const canShowCachedTradingButtons = Boolean(
    !displayReady.statusReady && snapshotEntry?.account.accountAddress,
  );
  const isLiveStatusPending = canShowCachedTradingButtons;
  const coldStartEnableTradingMode = useMemo(() => {
    if (!isLiveStatusPending) {
      return undefined;
    }
    return getPerpsOrderPanelEnableTradingModeByAccount({
      accountId: snapshotEntry?.account.accountId,
      indexedAccountId: snapshotEntry?.account.indexedAccountId,
    });
  }, [
    isLiveStatusPending,
    snapshotEntry?.account.accountId,
    snapshotEntry?.account.indexedAccountId,
  ]);
  const orderPanelEnableTradingMode = useMemo(() => {
    if (
      isLiveStatusPending &&
      coldStartEnableTradingMode &&
      (coldStartEnableTradingMode.canAutoEnableInOrderPanel ||
        coldStartEnableTradingMode.requiresExplicitEnableTrading) &&
      !enableTradingMode.canAutoEnableInOrderPanel &&
      !enableTradingMode.requiresExplicitEnableTrading
    ) {
      return coldStartEnableTradingMode;
    }
    return enableTradingMode;
  }, [coldStartEnableTradingMode, enableTradingMode, isLiveStatusPending]);

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    tracePerpsMobileLayout('tradingPanel.state', {
      isMobile,
      tradingMode,
      canTrade: perpsAccountStatus.canTrade,
      isLiveStatusPending,
      isSubmitting,
    });
  }, [
    isLiveStatusPending,
    isMobile,
    isSubmitting,
    perpsAccountStatus.canTrade,
    tradingMode,
  ]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isMobile) {
        return;
      }
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
        tracePerpsMobileLayout('tradingPanel.layout', {
          rect,
          tradingMode,
          canTrade: perpsAccountStatus.canTrade,
          isLiveStatusPending,
          isSubmitting,
        });
        layoutRef.current = rect;
      }
    },
    [
      isLiveStatusPending,
      isMobile,
      isSubmitting,
      perpsAccountStatus.canTrade,
      tradingMode,
    ],
  );

  const canShowTradingButtons = useMemo(() => {
    return shouldShowPerpsOrderPanelTradingButtons({
      canShowCachedTradingButtons,
      statusReady: displayReady.statusReady,
      selectAccountLoading: perpsAccountLoading.selectAccountLoading,
      accountStatus: perpsAccountStatus,
      enableTradingMode: orderPanelEnableTradingMode,
    });
  }, [
    canShowCachedTradingButtons,
    displayReady.statusReady,
    orderPanelEnableTradingMode,
    perpsAccountLoading.selectAccountLoading,
    perpsAccountStatus,
  ]);

  const reserveMobileEnableTradingLayout = useMemo(
    () =>
      shouldReservePerpsMobileEnableTradingLayout({
        isMobile,
        canShowTradingButtons,
      }),
    [canShowTradingButtons, isMobile],
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
      onLayout={handleLayout}
    >
      <PerpTradingForm
        isSubmitting={isSubmitting}
        isMobile={isMobile}
        reserveMobileEnableTradingLayout={reserveMobileEnableTradingLayout}
      />
      {canShowTradingButtons ? (
        <TradingButtonGroup
          isMobile={isMobile}
          isLiveStatusPending={isLiveStatusPending}
          enableTradingModeOverride={orderPanelEnableTradingMode}
        />
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
