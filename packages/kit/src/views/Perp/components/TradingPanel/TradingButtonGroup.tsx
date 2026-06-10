import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import type { MutableRefObject } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Button,
  DashText,
  NumberSizeableText,
  Popover,
  SizableText,
  Toast,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  type ITradingFormData,
  type ITradingFormEmptySizeParams,
  useActiveTradeInstrumentAtom,
  usePerpsActivePositionAtom,
  useTradingFormAtom,
  useTradingFormEmptySizeParams,
  useTradingFormOrderPriceParams,
  useTradingFormSide,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  perpsActiveAccountStatusAtom,
  perpsNetworkStatusAtom,
  perpsWebSocketReadyStateAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountEnableTradingModeAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAssetAtom,
  usePerpsCommonConfigPersistAtom,
  usePerpsCustomSettingsAtom,
  usePerpsTradingPreferencesAtom,
  useTradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  SCALE_ORDER_MAX_COUNT,
  SCALE_ORDER_MIN_COUNT,
  SCALE_ORDER_MIN_NOTIONAL,
  buildScaleOrderLegs,
  getReduceOnlyOrderGuardError,
  getReduceOnlyPositionSnapshotError,
  getScaleOrderSizeSkew,
  normalizeScaleOrderCount,
  validateScaleOrderLegs,
} from '@onekeyhq/shared/src/utils/hyperliquidScaleOrderUtils';
import {
  getSpotTokenDisplayName,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import {
  EPerpsSizeInputMode,
  ETriggerOrderType,
} from '@onekeyhq/shared/types/hyperliquid/types';

import {
  useOrderConfirmWithMarketDataFreshness,
  usePerpsMarketDataFreshness,
} from '../../hooks';
import {
  type IEnableTradingWithDepositFallbackResult,
  useConfirmHyperliquidTerms,
  useRequestEnableTradingWithDepositFallback,
} from '../../hooks/useEnableTradingWithDepositFallback';
import { useLiquidationPrice } from '../../hooks/useLiquidationPrice';
import { useShowDepositWithdrawModal } from '../../hooks/useShowDepositWithdrawModal';
import { useTradingCalculationsForSide } from '../../hooks/useTradingCalculationsForSide';
import { useTradingPrice } from '../../hooks/useTradingPrice';
import { PerpTestIDs } from '../../testIDs';
import { shouldPreserveColdStartButtonVisualState } from '../../utils/accountScopedData';
import { getEnableTradingDialogConfirmDecision } from '../../utils/enableTradingDialogConfirm';
import { shouldApplyMinimumOrderGuard } from '../../utils/minimumOrderGuard';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../../utils/mobileLayoutTrace';
import {
  type IPerpsMarketDataFreshness,
  getPerpsMarketDataFreshness,
  shouldBlockPerpsTradingForMarketData,
} from '../../utils/perpsMarketDataFreshness';
import {
  type IPerpsOrderPanelEnableTradingMode,
  getPerpsOrderPanelPostEnableTradingResult,
  shouldBlockPerpsOrderPanelPreEnableTradingForMargin,
  shouldDisablePerpsOrderPanelTradingButton,
  shouldDisablePerpsOrderPanelTradingButtonForAccountLoading,
  shouldSkipPerpsOrderPanelComputedSizeValidation,
} from '../../utils/perpsOrderPanelEnableTrading';
import { getScaleOrderValidationErrorMessage } from '../../utils/scaleOrderValidation';
import { PERP_TRADE_BUTTON_COLORS } from '../../utils/styleUtils';

import { showEnableTradingStepsDialog } from './modals/EnableTradingStepsDialog';
import { showOrderConfirmDialog } from './modals/OrderConfirmModal';

import type { LayoutChangeEvent } from 'react-native';

const TWAP_MIN_DURATION_MINUTES = 5;
const TWAP_MAX_DURATION_MINUTES = 1440;
const TWAP_ESTIMATED_SLICE_INTERVAL_SECONDS = 30;

interface ITradingButtonGroupProps {
  isMobile: boolean;
  isLiveStatusPending?: boolean;
  enableTradingModeOverride?: IPerpsOrderPanelEnableTradingMode;
}

interface ISideButtonProps {
  side: 'long' | 'short';
  isMobile: boolean;
  isLiveStatusPending?: boolean;
  enableTradingModeOverride?: IPerpsOrderPanelEnableTradingMode;
  marketDataFreshness: IPerpsMarketDataFreshness;
  handleConfirm: (overrideSide?: 'long' | 'short') => Promise<void>;
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
    | undefined;
}

const PERPS_WEBSOCKET_OPEN_READY_STATE = 1;
const noopHandleConfirm: (
  overrideSide?: 'long' | 'short',
) => Promise<void> = async () => undefined;

function getPerpsAccountKey(account: {
  accountId?: string | null;
  indexedAccountId?: string | null;
  accountAddress?: string | null;
}) {
  const accountId = account.accountId ?? account.indexedAccountId;
  if (!accountId && !account.accountAddress) {
    return undefined;
  }
  return `${accountId ?? ''}:${account.accountAddress ?? ''}`;
}

function hasPerpsOrderSizeInput(
  formData: Pick<ITradingFormData, 'sizeInputMode' | 'size' | 'sizePercent'>,
) {
  if (formData.sizeInputMode === EPerpsSizeInputMode.SLIDER) {
    return (formData.sizePercent ?? 0) > 0;
  }
  return Boolean(formData.size?.trim());
}

function shouldUseEmptySizeTradingButtons(
  formData: ITradingFormEmptySizeParams,
) {
  const isAlgoOrderMode =
    formData.orderMode === 'scale' || formData.orderMode === 'twap';
  return (
    formData.orderMode !== 'trigger' &&
    !isAlgoOrderMode &&
    !formData.bboPriceMode &&
    !hasPerpsOrderSizeInput(formData)
  );
}

async function getLatestPerpsMarketDataFreshness() {
  const [networkStatus, readyState] = await Promise.all([
    perpsNetworkStatusAtom.get(),
    perpsWebSocketReadyStateAtom.get(),
  ]);

  return getPerpsMarketDataFreshness({
    isWebSocketConnected:
      readyState?.readyState === PERPS_WEBSOCKET_OPEN_READY_STATE,
    networkConnected: networkStatus?.connected,
    lastMessageAt: networkStatus?.lastMessageAt ?? null,
  });
}

// Est. Liq price isolated into its own leaf: it owns the price-driven
// `useLiquidationPrice` subscription, so a price tick re-renders ONLY this
// text node instead of the whole side button. Value is debounced (~10Hz).
const EstLiqPriceLeaf = memo(({ side }: { side: 'long' | 'short' }) => {
  const liquidationPrice = useDebounce(useLiquidationPrice(side), 100);
  if (liquidationPrice) {
    return (
      <NumberSizeableText
        size="$bodySm"
        color="$text"
        formatter="price"
        formatterOptions={{ currency: '$' }}
      >
        {liquidationPrice.toNumber()}
      </NumberSizeableText>
    );
  }
  return (
    <SizableText size="$bodySm" color="$text">
      --
    </SizableText>
  );
});
EstLiqPriceLeaf.displayName = 'EstLiqPriceLeaf';

function SideButtonInternal({
  side,
  isMobile,
  isLiveStatusPending = false,
  enableTradingModeOverride,
  marketDataFreshness,
  handleConfirm,
  justifyContent = 'flex-start',
}: ISideButtonProps) {
  const intl = useIntl();
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  const themeVariant = useThemeVariant();
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [enableTradingMode] = usePerpsActiveAccountEnableTradingModeAtom();
  const effectiveEnableTradingMode =
    enableTradingModeOverride ?? enableTradingMode;
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [perpsCustomSettings] = usePerpsCustomSettingsAtom();
  const [formData] = useTradingFormAtom();
  const [tradingPreferences] = usePerpsTradingPreferencesAtom();
  const [tradingMode] = useTradingModeAtom();
  const isSpot = tradingMode === 'spot';
  // SizeInput already collapses 'margin' → 'usd' in spot to keep the input
  // box consistent. Mirror that here so secondary text and minimum-order
  // hints stay aligned with what the user actually sees.
  const resolvedSizeInputUnit =
    isSpot && tradingPreferences.sizeInputUnit === 'margin'
      ? 'usd'
      : tradingPreferences.sizeInputUnit;
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const orderContextKey = useMemo(
    () =>
      [
        tradingMode,
        activeTradeInstrument.mode,
        activeTradeInstrument.assetId ?? '',
        activeAsset?.coin ?? '',
      ].join(':'),
    [
      activeAsset?.coin,
      activeTradeInstrument.assetId,
      activeTradeInstrument.mode,
      tradingMode,
    ],
  );
  const [activePositionsValue] = usePerpsActivePositionAtom();

  const [isSubmitting] = useTradingLoadingAtom();
  const { midPriceBN } = useTradingPrice();
  const shouldBlockForMarketData =
    shouldBlockPerpsTradingForMarketData(marketDataFreshness);
  const confirmHyperliquidTerms = useConfirmHyperliquidTerms();
  const requestEnableTradingWithDepositFallback =
    useRequestEnableTradingWithDepositFallback();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  const perpsAccountKey = useMemo(
    () => getPerpsAccountKey(perpsAccount),
    [perpsAccount],
  );
  const perpsAccountKeyRef = useRef(perpsAccountKey);
  perpsAccountKeyRef.current = perpsAccountKey;
  // handleConfirmRef: always points to the latest handleConfirm so that
  // after an async await we use fresh formData, not a stale closure.
  const handleConfirmRef = useRef(handleConfirm);
  handleConfirmRef.current = handleConfirm;

  const szDecimals = useMemo(() => {
    if (isSpot && activeTradeInstrument.mode === 'spot') {
      return activeTradeInstrument.universe?.baseSzDecimals ?? 2;
    }
    return activeAsset?.universe?.szDecimals ?? 2;
  }, [isSpot, activeTradeInstrument, activeAsset?.universe?.szDecimals]);

  const calculations = useTradingCalculationsForSide(side);
  const {
    computedSizeForSide,
    orderValue,
    marginRequired: marginRequiredRaw,
    isNoEnoughMargin,
    effectivePriceBN,
    priceError,
    leverage,
  } = calculations;

  const marginRequired = useDebounce(marginRequiredRaw, 100);

  const isMinimumOrderNotMetForSide = useMemo(() => {
    if (
      !shouldApplyMinimumOrderGuard({
        isSpot,
        orderMode: formData.orderMode,
        orderType: formData.type,
        hasBboPriceMode: Boolean(formData.bboPriceMode),
      })
    ) {
      return false;
    }
    if (!orderValue || !orderValue.isFinite() || orderValue.lte(0))
      return false;
    return orderValue.lt(10);
  }, [
    formData.bboPriceMode,
    formData.orderMode,
    formData.type,
    isSpot,
    orderValue,
  ]);

  const isAccountLoading = useMemo<boolean>(() => {
    return (
      perpsAccountLoading.enableTradingLoading ||
      perpsAccountLoading.selectAccountLoading
    );
  }, [
    perpsAccountLoading.enableTradingLoading,
    perpsAccountLoading.selectAccountLoading,
  ]);

  const isServerActionDisabled = useMemo(
    () =>
      Boolean(
        perpConfigCommon?.disablePerpActionPerp ||
        perpConfigCommon?.ipDisablePerp,
      ),
    [perpConfigCommon?.disablePerpActionPerp, perpConfigCommon?.ipDisablePerp],
  );

  const shouldAutoEnableTrading = useMemo(
    () =>
      !perpsAccountStatus.canTrade &&
      effectiveEnableTradingMode.canAutoEnableInOrderPanel,
    [
      effectiveEnableTradingMode.canAutoEnableInOrderPanel,
      perpsAccountStatus.canTrade,
    ],
  );

  const shouldShowEnableTradingDialog = useMemo(
    () =>
      !perpsAccountStatus.canTrade &&
      effectiveEnableTradingMode.requiresExplicitEnableTrading,
    [
      effectiveEnableTradingMode.requiresExplicitEnableTrading,
      perpsAccountStatus.canTrade,
    ],
  );

  const shouldEnableTradingBeforeOrder =
    shouldAutoEnableTrading || shouldShowEnableTradingDialog;

  const isTradingStatusDisabled = useMemo(
    () => !perpsAccountStatus.canTrade && !shouldEnableTradingBeforeOrder,
    [perpsAccountStatus.canTrade, shouldEnableTradingBeforeOrder],
  );

  const shouldDisableForAccountLoading = useMemo(
    () =>
      shouldDisablePerpsOrderPanelTradingButtonForAccountLoading({
        selectAccountLoading: perpsAccountLoading.selectAccountLoading,
        enableTradingLoading: perpsAccountLoading.enableTradingLoading,
        enableTradingTriggered: perpsAccountLoading.enableTradingTriggered,
        enableTradingStatusPending:
          perpsAccountLoading.enableTradingStatusPending,
        isLiveStatusPending,
      }),
    [
      isLiveStatusPending,
      perpsAccountLoading.enableTradingLoading,
      perpsAccountLoading.enableTradingTriggered,
      perpsAccountLoading.enableTradingStatusPending,
      perpsAccountLoading.selectAccountLoading,
    ],
  );
  const shouldShowButtonLoading = shouldDisableForAccountLoading;

  const hasNonColdStartDisabledReason = useMemo(
    () =>
      Boolean(
        (!shouldAutoEnableTrading && isNoEnoughMargin) ||
        (!perpsAccountStatus.canTrade && !shouldEnableTradingBeforeOrder) ||
        isSubmitting ||
        priceError === 'bbo_unavailable' ||
        isServerActionDisabled,
      ),
    [
      perpsAccountStatus.canTrade,
      isNoEnoughMargin,
      isServerActionDisabled,
      isSubmitting,
      priceError,
      shouldAutoEnableTrading,
      shouldEnableTradingBeforeOrder,
    ],
  );

  const shouldPreserveDisabledButtonStyle =
    shouldPreserveColdStartButtonVisualState({
      isLiveStatusPending,
      hasNonColdStartDisabledReason,
    });

  const buttonDisabled = useMemo(() => {
    return shouldDisablePerpsOrderPanelTradingButton({
      isTradingStatusDisabled,
      shouldEnableTradingBeforeOrder,
      isNoEnoughMargin,
      isAccountLoading: shouldDisableForAccountLoading,
      isSubmitting,
      hasBboPriceError: priceError === 'bbo_unavailable',
      isServerActionDisabled,
    });
  }, [
    isTradingStatusDisabled,
    shouldEnableTradingBeforeOrder,
    isNoEnoughMargin,
    shouldDisableForAccountLoading,
    isSubmitting,
    priceError,
    isServerActionDisabled,
  ]);

  const buttonSecondaryText = useMemo(() => {
    if (isMobile && formData.orderMode === 'scale') {
      return null;
    }

    if (orderValue.isZero() || !orderValue.isFinite()) return null;

    if (resolvedSizeInputUnit === 'usd') {
      const usdValue = orderValue
        .decimalPlaces(2, BigNumber.ROUND_DOWN)
        .toFixed(2);
      return `≈ $${usdValue || '0.00'}`;
    }

    const sizeValue = computedSizeForSide
      .decimalPlaces(szDecimals, BigNumber.ROUND_DOWN)
      .toFixed(szDecimals);
    const displayName = (() => {
      if (isSpot && activeTradeInstrument.mode === 'spot') {
        const u = activeTradeInstrument.universe;
        return u ? getSpotTokenDisplayName(u.displayName || u.baseName) : '';
      }
      const symbol = activeAsset?.coin || '';
      return symbol ? parseDexCoin(symbol).displayName : '';
    })();
    return `${sizeValue} ${displayName}`;
  }, [
    formData.orderMode,
    isMobile,
    orderValue,
    resolvedSizeInputUnit,
    computedSizeForSide,
    szDecimals,
    isSpot,
    activeTradeInstrument,
    activeAsset?.coin,
  ]);

  const hasOrderValue = useMemo(
    () => orderValue.isFinite() && !orderValue.isZero(),
    [orderValue],
  );

  const spotTradeSymbol = useMemo(() => {
    if (!isSpot || activeTradeInstrument.mode !== 'spot') {
      return '';
    }
    const u = activeTradeInstrument.universe;
    if (!u) return '';
    return getSpotTokenDisplayName(u.displayName || u.baseName);
  }, [activeTradeInstrument, isSpot]);

  const buttonText = useMemo(() => {
    if (formData.orderMode === 'scale') {
      return side === 'long'
        ? intl.formatMessage({
            id: ETranslations.perp_preview_buy__action,
          })
        : intl.formatMessage({
            id: ETranslations.perp_preview_sell__action,
          });
    }
    if (priceError === 'bbo_unavailable' && !shouldEnableTradingBeforeOrder)
      return intl.formatMessage({
        id: ETranslations.Perps_BBO_unavailable,
      });
    if (perpConfigCommon?.ipDisablePerp)
      return intl.formatMessage({
        id: ETranslations.perp_button_ip_restricted,
      });
    if (perpConfigCommon?.disablePerpActionPerp)
      return intl.formatMessage({
        id: ETranslations.perp_button_disable_perp,
      });
    if (!shouldEnableTradingBeforeOrder && isNoEnoughMargin)
      return intl.formatMessage({
        id: isSpot
          ? ETranslations.dexmarket_insufficient_balance
          : ETranslations.perp_trading_button_no_enough_margin,
      });
    if (isSpot) {
      if (!spotTradeSymbol) {
        return side === 'long'
          ? intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_buy,
            })
          : intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_sell,
            });
      }
      return side === 'long'
        ? intl.formatMessage(
            {
              id: ETranslations.dexmarket_buy_token_default,
            },
            { TokenName: spotTradeSymbol },
          )
        : intl.formatMessage(
            {
              id: ETranslations.dexmarket_sell_token_default,
            },
            { TokenName: spotTradeSymbol },
          );
    }
    return side === 'long'
      ? intl.formatMessage({ id: ETranslations.perp_trade_long })
      : intl.formatMessage({ id: ETranslations.perp_trade_short });
  }, [
    priceError,
    formData.orderMode,
    isNoEnoughMargin,
    isSpot,
    side,
    spotTradeSymbol,
    intl,
    perpConfigCommon?.ipDisablePerp,
    perpConfigCommon?.disablePerpActionPerp,
    shouldEnableTradingBeforeOrder,
  ]);

  const isLong = side === 'long';
  const isTriggerMode = formData.orderMode === 'trigger';
  const isScaleMode = formData.orderMode === 'scale';
  const isTwapMode = formData.orderMode === 'twap';
  const shouldShowCostAndLiqPrice = !isSpot && !isScaleMode && !isTwapMode;
  const latestOrderPanelStateRef = useRef({
    activeAsset,
    activePositionsValue,
    activeTradeInstrument,
    computedSizeForSide,
    effectivePriceBN,
    formData,
    isMinimumOrderNotMetForSide,
    isNoEnoughMargin,
    isSpot,
    isScaleMode,
    isTriggerMode,
    isTwapMode,
    leverage,
    marketDataFreshness,
    midPriceBN,
    orderContextKey,
    perpsAccount,
    perpsCustomSettings,
    priceError,
    resolvedSizeInputUnit,
    side,
    shouldBlockForMarketData,
    szDecimals,
  });
  latestOrderPanelStateRef.current = {
    activeAsset,
    activePositionsValue,
    activeTradeInstrument,
    computedSizeForSide,
    effectivePriceBN,
    formData,
    isMinimumOrderNotMetForSide,
    isNoEnoughMargin,
    isSpot,
    isScaleMode,
    isTriggerMode,
    isTwapMode,
    leverage,
    marketDataFreshness,
    midPriceBN,
    orderContextKey,
    perpsAccount,
    perpsCustomSettings,
    priceError,
    resolvedSizeInputUnit,
    side,
    shouldBlockForMarketData,
    szDecimals,
  };

  type ILatestOrderPanelState = typeof latestOrderPanelStateRef.current;

  const validateOrderPanelState = useCallback(
    ({
      orderPanelState,
      validationSide,
      shouldValidateBboPriceError,
    }: {
      orderPanelState: ILatestOrderPanelState;
      validationSide: 'long' | 'short';
      shouldValidateBboPriceError: boolean;
    }) => {
      const {
        activeAsset: latestActiveAsset,
        activeTradeInstrument: latestActiveTradeInstrument,
        computedSizeForSide: latestComputedSizeForSide,
        effectivePriceBN: latestEffectivePriceBN,
        formData: latestFormData,
        isMinimumOrderNotMetForSide: latestIsMinimumOrderNotMetForSide,
        isSpot: latestIsSpot,
        isScaleMode: latestIsScaleMode,
        isTriggerMode: latestIsTriggerMode,
        isTwapMode: latestIsTwapMode,
        leverage: latestLeverage,
        midPriceBN: latestMidPriceBN,
        priceError: latestPriceError,
        resolvedSizeInputUnit: latestResolvedSizeInputUnit,
        shouldBlockForMarketData: latestShouldBlockForMarketData,
        szDecimals: latestSzDecimals,
      } = orderPanelState;

      if (
        shouldValidateBboPriceError &&
        latestPriceError === 'bbo_unavailable'
      ) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.Perps_BBO_unavailable,
          }),
        });
        return false;
      }

      if (latestShouldBlockForMarketData) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.perp_offline,
          }),
          message: intl.formatMessage({
            id: ETranslations.perps_offline_moblie,
          }),
        });
        return false;
      }

      if (latestIsTriggerMode && latestFormData.triggerOrderType) {
        const tp = latestFormData.triggerPrice?.trim();
        if (!tp || new BigNumber(tp).lte(0)) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perps_input_trigger_price,
            }),
          });
          return false;
        }
        const isLimitTrigger =
          latestFormData.triggerOrderType === ETriggerOrderType.TRIGGER_LIMIT;
        if (isLimitTrigger) {
          const ep = latestFormData.executionPrice?.trim();
          if (!ep || new BigNumber(ep).lte(0)) {
            Toast.message({
              title: intl.formatMessage({
                id: ETranslations.perp_trade_price_place_holder,
              }),
            });
            return false;
          }
        }
        if (!latestMidPriceBN.isFinite() || latestMidPriceBN.lte(0)) {
          Toast.error({ title: 'Market price unavailable, please try again' });
          return false;
        }
        if (new BigNumber(tp).eq(latestMidPriceBN)) {
          Toast.error({
            title: 'Trigger price must differ from current price',
          });
          return false;
        }
      }

      if (
        !latestIsTriggerMode &&
        !latestIsScaleMode &&
        !latestIsTwapMode &&
        latestFormData.type === 'limit' &&
        (!latestFormData.price || latestFormData.price.trim() === '')
      ) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.perp_trade_price_place_holder,
          }),
        });
        return false;
      }

      if (latestIsScaleMode) {
        const lowerPrice = new BigNumber(latestFormData.scaleLowerPrice ?? 0);
        const upperPrice = new BigNumber(latestFormData.scaleUpperPrice ?? 0);
        if (
          !lowerPrice.isFinite() ||
          lowerPrice.lte(0) ||
          !upperPrice.isFinite() ||
          upperPrice.lte(0)
        ) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perp_scale_price_range_required__msg,
            }),
          });
          return false;
        }
        if (lowerPrice.eq(upperPrice)) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perp_scale_price_range_same__msg,
            }),
          });
          return false;
        }
        const orderCount = normalizeScaleOrderCount(
          latestFormData.scaleOrderCount ?? 0,
        );
        if (
          orderCount < SCALE_ORDER_MIN_COUNT ||
          orderCount > SCALE_ORDER_MAX_COUNT
        ) {
          Toast.message({
            title: intl.formatMessage(
              {
                id: ETranslations.perp_scale_order_count_range__msg,
              },
              {
                min: SCALE_ORDER_MIN_COUNT,
                max: SCALE_ORDER_MAX_COUNT,
              },
            ),
          });
          return false;
        }
      }

      if (latestIsTwapMode) {
        const duration = Number(latestFormData.twapDurationMinutes ?? 0);
        if (
          !Number.isInteger(duration) ||
          duration < TWAP_MIN_DURATION_MINUTES ||
          duration > TWAP_MAX_DURATION_MINUTES
        ) {
          Toast.message({
            title: `TWAP duration must be ${TWAP_MIN_DURATION_MINUTES}-${TWAP_MAX_DURATION_MINUTES} minutes`,
          });
          return false;
        }
      }

      const isSliderMode = latestFormData.sizeInputMode === 'slider';
      const hasSizeEmpty = isSliderMode
        ? !latestFormData.sizePercent || latestFormData.sizePercent <= 0
        : !latestFormData.size || latestFormData.size.trim() === '';
      const shouldSkipComputedSizeValidation =
        shouldSkipPerpsOrderPanelComputedSizeValidation({
          shouldValidateBboPriceError,
          hasBboPriceError: latestPriceError === 'bbo_unavailable',
        });
      if (
        hasSizeEmpty ||
        (!shouldSkipComputedSizeValidation &&
          (!latestComputedSizeForSide.gt(0) ||
            latestIsMinimumOrderNotMetForSide))
      ) {
        let minAmount = '$10';
        if (latestEffectivePriceBN.gt(0)) {
          const minSize = new BigNumber(10)
            .dividedBy(latestEffectivePriceBN)
            .decimalPlaces(latestSzDecimals, BigNumber.ROUND_UP);
          if (latestResolvedSizeInputUnit === 'token') {
            const coinSymbol = (() => {
              if (latestIsSpot && latestActiveTradeInstrument.mode === 'spot') {
                const u = latestActiveTradeInstrument.universe;
                return u
                  ? getSpotTokenDisplayName(u.displayName || u.baseName)
                  : '';
              }
              return latestActiveAsset?.coin
                ? parseDexCoin(latestActiveAsset.coin).displayName
                : '';
            })();
            minAmount = `${minSize.toFixed(latestSzDecimals)} ${coinSymbol}`;
          } else if (latestResolvedSizeInputUnit === 'margin') {
            const leverageBN = new BigNumber(latestLeverage || 1);
            if (leverageBN.isFinite() && leverageBN.gt(0)) {
              const minMargin = minSize
                .multipliedBy(latestEffectivePriceBN)
                .dividedBy(leverageBN)
                .decimalPlaces(2, BigNumber.ROUND_UP)
                .toFixed(2);
              minAmount = `$${minMargin}`;
            }
          }
        }
        Toast.message({
          title: intl.formatMessage(
            { id: ETranslations.perp_size_least },
            { amount: minAmount },
          ),
        });
        return false;
      }

      if (latestIsScaleMode) {
        const legs = buildScaleOrderLegs({
          totalSize: latestComputedSizeForSide.toFixed(),
          lowerPrice: latestFormData.scaleLowerPrice ?? '',
          upperPrice: latestFormData.scaleUpperPrice ?? '',
          orderCount: normalizeScaleOrderCount(
            latestFormData.scaleOrderCount ?? 0,
          ),
          szDecimals: latestSzDecimals,
          side: validationSide,
          sizeSkew: getScaleOrderSizeSkew(latestFormData.scaleSizeDistribution),
          assetType: latestIsSpot ? 'spot' : 'perp',
        });
        const validation = validateScaleOrderLegs({ legs });
        if (!validation.isValid) {
          Toast.message({
            title: getScaleOrderValidationErrorMessage({
              intl,
              validation,
              fallback: 'Invalid scale order',
            }),
          });
          return false;
        }
      }

      if (latestIsTwapMode) {
        const duration = Number(latestFormData.twapDurationMinutes ?? 0);
        const estimatedSlices = Math.max(
          1,
          Math.ceil((duration * 60) / TWAP_ESTIMATED_SLICE_INTERVAL_SECONDS),
        );
        const totalNotional = latestComputedSizeForSide.multipliedBy(
          latestEffectivePriceBN,
        );
        const averageSliceNotional = totalNotional.dividedBy(estimatedSlices);
        if (
          !averageSliceNotional.isFinite() ||
          averageSliceNotional.lt(SCALE_ORDER_MIN_NOTIONAL)
        ) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perp_twap_small_slice__msg,
            }),
          });
          return false;
        }
      }

      const tpValue = latestFormData.tpValue?.trim();
      const slValue = latestFormData.slValue?.trim();
      const hasTpValue = Boolean(tpValue);
      const hasSlValue = Boolean(slValue);

      if (
        !latestIsTriggerMode &&
        !latestIsScaleMode &&
        !latestIsTwapMode &&
        latestFormData.hasTpsl &&
        (hasTpValue || hasSlValue)
      ) {
        let tpTriggerPrice: BigNumber | null = null;
        let slTriggerPrice: BigNumber | null = null;

        if (hasTpValue && tpValue) {
          if (latestFormData.tpType === 'price') {
            tpTriggerPrice = new BigNumber(tpValue);
          } else {
            const percent = new BigNumber(tpValue);
            if (percent.isFinite()) {
              const percentChange = latestEffectivePriceBN
                .multipliedBy(percent)
                .dividedBy(100);
              tpTriggerPrice =
                validationSide === 'long'
                  ? latestEffectivePriceBN.plus(percentChange)
                  : latestEffectivePriceBN.minus(percentChange);
            }
          }
        }

        if (hasSlValue && slValue) {
          if (latestFormData.slType === 'price') {
            slTriggerPrice = new BigNumber(slValue);
          } else {
            const percent = new BigNumber(slValue);
            if (percent.isFinite()) {
              const percentChange = latestEffectivePriceBN
                .multipliedBy(percent)
                .dividedBy(100);
              slTriggerPrice =
                validationSide === 'long'
                  ? latestEffectivePriceBN.minus(percentChange)
                  : latestEffectivePriceBN.plus(percentChange);
            }
          }
        }

        if (
          hasTpValue &&
          tpTriggerPrice &&
          tpTriggerPrice.isFinite() &&
          latestEffectivePriceBN.gt(0)
        ) {
          if (
            validationSide === 'long' &&
            tpTriggerPrice.lte(latestEffectivePriceBN)
          ) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_sl,
              }),
              message: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_desc_1,
              }),
            });
            return false;
          }
          if (
            validationSide === 'short' &&
            tpTriggerPrice.gte(latestEffectivePriceBN)
          ) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_sl,
              }),
              message: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_desc_2,
              }),
            });
            return false;
          }
        }

        if (
          hasSlValue &&
          slTriggerPrice &&
          slTriggerPrice.isFinite() &&
          latestEffectivePriceBN.gt(0)
        ) {
          if (
            validationSide === 'long' &&
            slTriggerPrice.gte(latestEffectivePriceBN)
          ) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_sl,
              }),
              message: intl.formatMessage({
                id: ETranslations.perp_invaild_sl_desc_1,
              }),
            });
            return false;
          }
          if (
            validationSide === 'short' &&
            slTriggerPrice.lte(latestEffectivePriceBN)
          ) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_sl,
              }),
              message: intl.formatMessage({
                id: ETranslations.perp_invaild_sl_desc_2,
              }),
            });
            return false;
          }
        }
      }

      return true;
    },
    [intl],
  );

  const requestOrderPanelEnableTrading = useCallback(
    async ({
      beforeDeposit,
      shouldIgnoreResult,
      showLoadingToast,
    }: {
      beforeDeposit?: () => void;
      shouldIgnoreResult: () => boolean;
      showLoadingToast: boolean;
    }): Promise<IEnableTradingWithDepositFallbackResult> => {
      const stopResult: IEnableTradingWithDepositFallbackResult = {
        shouldContinue: false,
        status: undefined,
      };
      if (shouldShowEnableTradingDialog) {
        // The dialog must reflect a fresh account-status snapshot; the
        // background enable flow revalidates immediately and can otherwise
        // require more signatures than the stale UI predicted.
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
        } catch (error) {
          errorToastUtils.toastIfError(error);
          return stopResult;
        }
        const latestPerpsAccountStatus =
          (await perpsActiveAccountStatusAtom.get()) ?? perpsAccountStatus;
        if (shouldIgnoreResult()) {
          return stopResult;
        }
        const confirmDecision = getEnableTradingDialogConfirmDecision(
          latestPerpsAccountStatus,
        );
        if (confirmDecision === 'continue') {
          return {
            shouldContinue: true,
            status: latestPerpsAccountStatus,
          };
        }
        if (confirmDecision === 'deposit') {
          beforeDeposit?.();
          await showDepositWithdrawModal('deposit');
          return stopResult;
        }
        const result = await showEnableTradingStepsDialog({
          accountStatus: latestPerpsAccountStatus,
          onConfirm: async ({ closeDialog }) => {
            if (shouldIgnoreResult()) {
              return stopResult;
            }
            const didAcceptTerms = await confirmHyperliquidTerms();
            if (!didAcceptTerms || shouldIgnoreResult()) {
              return stopResult;
            }
            return requestEnableTradingWithDepositFallback({
              beforeDeposit: () => {
                closeDialog();
                beforeDeposit?.();
              },
              shouldIgnoreResult,
            });
          },
        });
        return result ?? stopResult;
      }

      const didAcceptTerms = await confirmHyperliquidTerms();
      if (!didAcceptTerms || shouldIgnoreResult()) {
        return stopResult;
      }

      const loadingToast = showLoadingToast
        ? Toast.loading({
            title: intl.formatMessage({
              id: ETranslations.perp_trade_button_enable_trading,
            }),
            duration: Infinity,
          })
        : undefined;
      try {
        return await requestEnableTradingWithDepositFallback({
          beforeDeposit,
          shouldIgnoreResult,
        });
      } finally {
        loadingToast?.close();
      }
    },
    [
      confirmHyperliquidTerms,
      intl,
      perpsAccountStatus,
      requestEnableTradingWithDepositFallback,
      showDepositWithdrawModal,
      shouldShowEnableTradingDialog,
    ],
  );

  const buttonStyles = useMemo(() => {
    const colors = PERP_TRADE_BUTTON_COLORS;
    const getBgColor = () => {
      if (shouldShowButtonLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'long' : 'short']
        : colors.dark[isLong ? 'long' : 'short'];
    };

    const getHoverBgColor = () => {
      if (shouldShowButtonLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'longHover' : 'shortHover']
        : colors.dark[isLong ? 'longHover' : 'shortHover'];
    };

    const getPressBgColor = () => {
      if (shouldShowButtonLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'longPress' : 'shortPress']
        : colors.dark[isLong ? 'longPress' : 'shortPress'];
    };

    return {
      bg: getBgColor(),
      hoverBg: getHoverBgColor(),
      pressBg: getPressBgColor(),
    };
  }, [isLong, shouldShowButtonLoading, themeVariant]);

  const handlePress = useDebouncedCallback(
    async (): Promise<void> => {
      if (!shouldEnableTradingBeforeOrder && !perpsAccountStatus.canTrade) {
        return;
      }

      const preEnableOrderPanelState = latestOrderPanelStateRef.current;

      if (shouldEnableTradingBeforeOrder) {
        const isDepositRequired =
          perpsAccountStatus.details?.activatedOk === false;
        if (
          shouldBlockPerpsOrderPanelPreEnableTradingForMargin({
            shouldEnableTradingBeforeOrder,
            isNoEnoughMargin: preEnableOrderPanelState.isNoEnoughMargin,
            isDepositRequired,
          })
        ) {
          Toast.message({
            title: intl.formatMessage({
              id: preEnableOrderPanelState.isSpot
                ? ETranslations.dexmarket_insufficient_balance
                : ETranslations.perp_trading_button_no_enough_margin,
            }),
          });
          return;
        }

        const enableTradingAccountKey = perpsAccountKey;
        const enableTradingSide = side;
        const enableTradingOrderContextKey =
          preEnableOrderPanelState.orderContextKey;
        const shouldIgnoreEnableTradingResult = () =>
          Boolean(
            enableTradingAccountKey &&
            perpsAccountKeyRef.current !== enableTradingAccountKey,
          );

        // Enable trading MUST run before the order confirm dialog: the order
        // panel first resolves the trading-enabled state (auto-enable or the
        // hardware steps dialog), then shows the order confirmation. Do not
        // defer this into the confirm dialog's pre-confirm hook.
        const result = await requestOrderPanelEnableTrading({
          shouldIgnoreResult: shouldIgnoreEnableTradingResult,
          showLoadingToast: shouldAutoEnableTrading,
        });
        const postEnableState = latestOrderPanelStateRef.current;
        const postEnableTradingResult =
          getPerpsOrderPanelPostEnableTradingResult({
            enableTradingShouldContinue: result?.shouldContinue,
            shouldIgnoreEnableTradingResult: shouldIgnoreEnableTradingResult(),
            isOrderContextChanged:
              postEnableState.side !== enableTradingSide ||
              postEnableState.orderContextKey !== enableTradingOrderContextKey,
            isNoEnoughMargin: postEnableState.isNoEnoughMargin,
          });
        if (postEnableTradingResult === 'stop') {
          return;
        }
        if (postEnableTradingResult === 'noEnoughMargin') {
          Toast.message({
            title: intl.formatMessage({
              id: postEnableState.isSpot
                ? ETranslations.dexmarket_insufficient_balance
                : ETranslations.perp_trading_button_no_enough_margin,
            }),
          });
          return;
        }
      }

      // Validate the order only AFTER trading is enabled (matching the
      // original flow): a not-yet-enabled account has no margin/leverage data
      // yet, so computedSizeForSide is 0 and a pre-enable size check would
      // wrongly raise the "minimum $10" toast and swallow the enable-trading
      // dialog. Running validation here covers both the just-enabled path and
      // accounts that can already trade.
      const validationState = latestOrderPanelStateRef.current;
      if (
        !validateOrderPanelState({
          orderPanelState: validationState,
          validationSide: side,
          shouldValidateBboPriceError: true,
        })
      ) {
        return;
      }
      const submitState = latestOrderPanelStateRef.current;
      const reduceOnly =
        !submitState.isSpot &&
        ((submitState.isScaleMode && submitState.formData.scaleReduceOnly) ||
          (submitState.isTwapMode && submitState.formData.twapReduceOnly));
      if (reduceOnly) {
        const snapshotError = getReduceOnlyPositionSnapshotError({
          reduceOnly,
          accountAddress: submitState.perpsAccount?.accountAddress,
          positionsAccountAddress:
            submitState.activePositionsValue.accountAddress,
        });
        if (snapshotError) {
          Toast.message({ title: snapshotError });
          return;
        }
        const position = submitState.activePositionsValue.activePositions.find(
          (pos) => pos.position.coin === submitState.activeTradeInstrument.coin,
        )?.position;
        const reduceOnlyError = getReduceOnlyOrderGuardError({
          reduceOnly,
          side,
          size: submitState.computedSizeForSide,
          positionSize: position?.szi,
          missingPositionMessage: submitState.isTwapMode
            ? intl.formatMessage({
                id: ETranslations.perp_twap_reduce_only_opposite_position_required__msg,
              })
            : intl.formatMessage({
                id: ETranslations.perp_scale_reduce_only_opposite_position_required__msg,
              }),
          exceedsPositionMessage: submitState.isTwapMode
            ? intl.formatMessage({
                id: ETranslations.perp_twap_reduce_only_size_exceeds_position__msg,
              })
            : intl.formatMessage({
                id: ETranslations.perp_scale_reduce_only_size_exceeds_position__msg,
              }),
        });
        if (reduceOnlyError) {
          Toast.message({ title: reduceOnlyError });
          return;
        }
      }

      if (submitState.perpsCustomSettings.skipOrderConfirm) {
        void handleConfirmRef.current(side);
      } else {
        showOrderConfirmDialog({
          overrideSide: side,
          intl,
        });
      }
    },
    1000,
    {
      leading: true,
      trailing: false,
    },
  );
  useEffect(() => {
    if (!isMobile) {
      return;
    }
    tracePerpsMobileLayout('tradingButton.side.state', {
      side,
      isSpot,
      canTrade: perpsAccountStatus.canTrade,
      buttonDisabled,
      isAccountLoading,
      isLiveStatusPending,
      enableTradingLoading: perpsAccountLoading.enableTradingLoading,
      enableTradingTriggered: perpsAccountLoading.enableTradingTriggered,
      enableTradingStatusPending:
        perpsAccountLoading.enableTradingStatusPending,
      selectAccountLoading: perpsAccountLoading.selectAccountLoading,
      isNoEnoughMargin,
      priceError,
      hasSecondaryText: Boolean(buttonSecondaryText),
      hasOrderValue,
      disablePerpAction: Boolean(perpConfigCommon?.disablePerpActionPerp),
      ipDisablePerp: Boolean(perpConfigCommon?.ipDisablePerp),
      marketDataFreshness: marketDataFreshness.reason,
    });
  }, [
    buttonDisabled,
    buttonSecondaryText,
    hasOrderValue,
    isAccountLoading,
    isLiveStatusPending,
    isMobile,
    isNoEnoughMargin,
    isSpot,
    perpConfigCommon?.disablePerpActionPerp,
    perpConfigCommon?.ipDisablePerp,
    perpsAccountLoading.enableTradingLoading,
    perpsAccountLoading.enableTradingTriggered,
    perpsAccountLoading.enableTradingStatusPending,
    perpsAccountLoading.selectAccountLoading,
    perpsAccountStatus.canTrade,
    priceError,
    side,
    marketDataFreshness.reason,
  ]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isMobile) {
        return;
      }
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
        tracePerpsMobileLayout('tradingButton.side.layout', {
          rect,
          side,
          isSpot,
          buttonDisabled,
          isAccountLoading,
          isLiveStatusPending,
          hasSecondaryText: Boolean(buttonSecondaryText),
        });
        layoutRef.current = rect;
      }
    },
    [
      buttonDisabled,
      buttonSecondaryText,
      isAccountLoading,
      isLiveStatusPending,
      isMobile,
      isSpot,
      side,
    ],
  );
  const desktopCostTooltipContent = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.perp_trade_margin_tooltip,
      }),
    [intl],
  );
  const desktopCostTooltipTrigger = useMemo(
    () => (
      <DashText
        size="$bodySm"
        color="$textSubdued"
        cursor="default"
        dashThickness={0.5}
      >
        {intl.formatMessage({
          id: ETranslations.perp_cost,
        })}
      </DashText>
    ),
    [intl],
  );
  const desktopLiqPriceTooltipContent = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.perp_est_liq_price_tooltip,
      }),
    [intl],
  );
  const desktopLiqPriceTooltipTrigger = useMemo(
    () => (
      <DashText
        size="$bodySm"
        color="$textSubdued"
        cursor="default"
        dashThickness={0.5}
      >
        {intl.formatMessage({
          id: ETranslations.perp_est_liq_price,
        })}
      </DashText>
    ),
    [intl],
  );

  if (isMobile) {
    return (
      <YStack gap="$2" flex={1} onLayout={handleLayout}>
        {shouldShowCostAndLiqPrice ? (
          <YStack gap="$1.5">
            {/* <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.perp_trade_order_value })}
          </SizableText>
          <NumberSizeableText
            size="$bodySm"
            color="$text"
            formatter="value"
            formatterOptions={{ currency: '$' }}
          >
            {orderValue.toNumber()}
          </NumberSizeableText>
        </XStack> */}

            <XStack justifyContent="space-between">
              <DashText
                size="$bodySm"
                color="$textSubdued"
                dashThickness={0.3}
                tooltip={intl.formatMessage({
                  id: ETranslations.perp_trade_margin_tooltip,
                })}
                tooltipDisplayMode="popover"
                tooltipTitle={intl.formatMessage({
                  id: ETranslations.perp_trade_margin_required,
                })}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_cost,
                })}
              </DashText>

              <NumberSizeableText
                size="$bodySm"
                color="$text"
                formatter="value"
                formatterOptions={{ currency: '$' }}
              >
                {marginRequired.toNumber()}
              </NumberSizeableText>
            </XStack>

            <XStack justifyContent="space-between">
              <DashText
                size="$bodySm"
                color="$textSubdued"
                dashThickness={0.5}
                tooltip={intl.formatMessage({
                  id: ETranslations.perp_est_liq_price_tooltip,
                })}
                tooltipDisplayMode="popover"
                tooltipTitle={intl.formatMessage({
                  id: ETranslations.perp_est_liq_price,
                })}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_est_liq_price,
                })}
              </DashText>

              <EstLiqPriceLeaf side={side} />
            </XStack>
          </YStack>
        ) : null}

        <Button
          testID={isLong ? PerpTestIDs.LongButton : PerpTestIDs.ShortButton}
          size="medium"
          childrenAsText={false}
          borderRadius="$4"
          bg={buttonStyles.bg}
          hoverStyle={
            !buttonDisabled ? { bg: buttonStyles.hoverBg } : undefined
          }
          pressStyle={
            !buttonDisabled ? { bg: buttonStyles.pressBg } : undefined
          }
          disabled={buttonDisabled}
          disabledStyle={
            shouldPreserveDisabledButtonStyle ? { opacity: 1 } : undefined
          }
          loading={shouldShowButtonLoading}
          onPress={handlePress}
          h={36}
          py={
            !orderValue.isZero() && orderValue.isFinite() ? '$0.5' : undefined
          }
        >
          <YStack alignItems="center" gap={2}>
            <SizableText
              size="$bodyMdMedium"
              lineHeight={18}
              color="$textOnColor"
              numberOfLines={1}
            >
              {buttonText}
            </SizableText>

            {buttonSecondaryText ? (
              <SizableText
                fontSize={11}
                color="$textOnColor"
                opacity={0.8}
                lineHeight={11}
                numberOfLines={1}
              >
                {buttonSecondaryText}
              </SizableText>
            ) : null}
          </YStack>
        </Button>
      </YStack>
    );
  }
  return (
    <YStack gap="$2" flex={1} onLayout={handleLayout}>
      <Button
        testID={isLong ? PerpTestIDs.LongButton : PerpTestIDs.ShortButton}
        size="medium"
        childrenAsText={false}
        borderRadius="$4"
        bg={buttonStyles.bg}
        hoverStyle={!buttonDisabled ? { bg: buttonStyles.hoverBg } : undefined}
        pressStyle={!buttonDisabled ? { bg: buttonStyles.pressBg } : undefined}
        disabled={buttonDisabled}
        disabledStyle={
          shouldPreserveDisabledButtonStyle ? { opacity: 1 } : undefined
        }
        loading={shouldShowButtonLoading}
        onPress={handlePress}
        h={36}
        py={!orderValue.isZero() && orderValue.isFinite() ? '$0.5' : undefined}
      >
        <YStack alignItems="center" gap={2}>
          <SizableText
            size="$bodyMdMedium"
            lineHeight={18}
            color="$textOnColor"
            numberOfLines={1}
          >
            {buttonText}
          </SizableText>
          {buttonSecondaryText ? (
            <SizableText
              fontSize={11}
              color="$textOnColor"
              opacity={0.8}
              lineHeight={11}
              numberOfLines={1}
            >
              {buttonSecondaryText}
            </SizableText>
          ) : null}
        </YStack>
      </Button>
      {shouldShowCostAndLiqPrice ? (
        <YStack gap="$1.5">
          {/* <XStack justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.perp_trade_order_value })}
            </SizableText>
            <NumberSizeableText
              size="$bodySm"
              color="$text"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {orderValue.toNumber()}
            </NumberSizeableText>
          </XStack> */}

          <XStack gap="$2" justifyContent={justifyContent}>
            <Tooltip
              placement="top"
              triggerAsChild="except-style"
              renderContent={desktopCostTooltipContent}
              renderTrigger={desktopCostTooltipTrigger}
            />

            <NumberSizeableText
              size="$bodySm"
              color="$text"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {marginRequired.toNumber()}
            </NumberSizeableText>
          </XStack>

          <XStack gap="$2" justifyContent={justifyContent}>
            <Tooltip
              placement="top"
              triggerAsChild="except-style"
              renderContent={desktopLiqPriceTooltipContent}
              renderTrigger={desktopLiqPriceTooltipTrigger}
            />

            <EstLiqPriceLeaf side={side} />
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  );
}

const SideButtonLive = memo(SideButtonInternal);

function EmptySizeSideButton({
  side,
  isMobile,
  isLiveStatusPending = false,
  enableTradingModeOverride,
  justifyContent = 'flex-start',
}: Omit<ISideButtonProps, 'handleConfirm' | 'marketDataFreshness'>) {
  const intl = useIntl();
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  const themeVariant = useThemeVariant();
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [enableTradingMode] = usePerpsActiveAccountEnableTradingModeAtom();
  const effectiveEnableTradingMode =
    enableTradingModeOverride ?? enableTradingMode;
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const formData = useTradingFormOrderPriceParams();
  const [tradingMode] = useTradingModeAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [isSubmitting] = useTradingLoadingAtom();
  const isSpot = tradingMode === 'spot';
  const isLong = side === 'long';
  const confirmHyperliquidTerms = useConfirmHyperliquidTerms();
  const requestEnableTradingWithDepositFallback =
    useRequestEnableTradingWithDepositFallback();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  const perpsAccountKey = useMemo(
    () => getPerpsAccountKey(perpsAccount),
    [perpsAccount],
  );
  const perpsAccountKeyRef = useRef(perpsAccountKey);
  perpsAccountKeyRef.current = perpsAccountKey;
  const isAccountLoading =
    perpsAccountLoading.enableTradingLoading ||
    perpsAccountLoading.selectAccountLoading;
  const shouldAutoEnableTrading =
    !perpsAccountStatus.canTrade &&
    effectiveEnableTradingMode.canAutoEnableInOrderPanel;
  const shouldShowEnableTradingDialog =
    !perpsAccountStatus.canTrade &&
    effectiveEnableTradingMode.requiresExplicitEnableTrading;
  const shouldEnableTradingBeforeOrder =
    shouldAutoEnableTrading || shouldShowEnableTradingDialog;
  const isServerActionDisabled = Boolean(
    perpConfigCommon?.disablePerpActionPerp || perpConfigCommon?.ipDisablePerp,
  );
  const hasNonColdStartDisabledReason =
    isSubmitting ||
    isServerActionDisabled ||
    (!shouldEnableTradingBeforeOrder && !perpsAccountStatus.canTrade);
  const shouldDisableForAccountLoading =
    shouldDisablePerpsOrderPanelTradingButtonForAccountLoading({
      selectAccountLoading: perpsAccountLoading.selectAccountLoading,
      enableTradingLoading: perpsAccountLoading.enableTradingLoading,
      enableTradingTriggered: perpsAccountLoading.enableTradingTriggered,
      enableTradingStatusPending:
        perpsAccountLoading.enableTradingStatusPending,
      isLiveStatusPending,
    });
  const shouldPreserveAccountLoadingButtonVisualState =
    shouldDisableForAccountLoading &&
    !perpsAccountLoading.enableTradingTriggered &&
    !hasNonColdStartDisabledReason;
  const shouldShowButtonLoading =
    shouldDisableForAccountLoading &&
    !shouldPreserveAccountLoadingButtonVisualState;
  const buttonDisabled =
    isLiveStatusPending ||
    shouldDisableForAccountLoading ||
    isSubmitting ||
    isServerActionDisabled ||
    (!shouldEnableTradingBeforeOrder && !perpsAccountStatus.canTrade);
  const shouldPreserveDisabledButtonStyle =
    shouldPreserveAccountLoadingButtonVisualState ||
    shouldPreserveColdStartButtonVisualState({
      isLiveStatusPending,
      hasNonColdStartDisabledReason,
    });

  const spotTradeSymbol = useMemo(() => {
    if (!isSpot || activeTradeInstrument.mode !== 'spot') {
      return '';
    }
    const u = activeTradeInstrument.universe;
    if (!u) return '';
    return getSpotTokenDisplayName(u.displayName || u.baseName);
  }, [activeTradeInstrument, isSpot]);

  const buttonText = useMemo(() => {
    if (perpConfigCommon?.ipDisablePerp)
      return intl.formatMessage({
        id: ETranslations.perp_button_ip_restricted,
      });
    if (perpConfigCommon?.disablePerpActionPerp)
      return intl.formatMessage({
        id: ETranslations.perp_button_disable_perp,
      });
    if (isSpot) {
      if (!spotTradeSymbol) {
        return side === 'long'
          ? intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_buy,
            })
          : intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_sell,
            });
      }
      return side === 'long'
        ? intl.formatMessage(
            {
              id: ETranslations.dexmarket_buy_token_default,
            },
            { TokenName: spotTradeSymbol },
          )
        : intl.formatMessage(
            {
              id: ETranslations.dexmarket_sell_token_default,
            },
            { TokenName: spotTradeSymbol },
          );
    }
    return side === 'long'
      ? intl.formatMessage({ id: ETranslations.perp_trade_long })
      : intl.formatMessage({ id: ETranslations.perp_trade_short });
  }, [
    intl,
    isSpot,
    perpConfigCommon?.disablePerpActionPerp,
    perpConfigCommon?.ipDisablePerp,
    side,
    spotTradeSymbol,
  ]);

  const buttonStyles = useMemo(() => {
    const colors = PERP_TRADE_BUTTON_COLORS;
    const getBgColor = () => {
      if (shouldShowButtonLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'long' : 'short']
        : colors.dark[isLong ? 'long' : 'short'];
    };

    const getHoverBgColor = () => {
      if (shouldShowButtonLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'longHover' : 'shortHover']
        : colors.dark[isLong ? 'longHover' : 'shortHover'];
    };

    const getPressBgColor = () => {
      if (shouldShowButtonLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'longPress' : 'shortPress']
        : colors.dark[isLong ? 'longPress' : 'shortPress'];
    };

    return {
      bg: getBgColor(),
      hoverBg: getHoverBgColor(),
      pressBg: getPressBgColor(),
    };
  }, [isLong, shouldShowButtonLoading, themeVariant]);

  const requestEmptySizeEnableTrading = useCallback(
    async ({
      beforeDeposit,
      shouldIgnoreResult,
      showLoadingToast,
    }: {
      beforeDeposit?: () => void;
      shouldIgnoreResult: () => boolean;
      showLoadingToast: boolean;
    }): Promise<IEnableTradingWithDepositFallbackResult> => {
      const stopResult: IEnableTradingWithDepositFallbackResult = {
        shouldContinue: false,
        status: undefined,
      };
      if (shouldShowEnableTradingDialog) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
        } catch (error) {
          errorToastUtils.toastIfError(error);
          return stopResult;
        }
        const latestPerpsAccountStatus =
          (await perpsActiveAccountStatusAtom.get()) ?? perpsAccountStatus;
        if (shouldIgnoreResult()) {
          return stopResult;
        }
        const confirmDecision = getEnableTradingDialogConfirmDecision(
          latestPerpsAccountStatus,
        );
        if (confirmDecision === 'continue') {
          return {
            shouldContinue: true,
            status: latestPerpsAccountStatus,
          };
        }
        if (confirmDecision === 'deposit') {
          beforeDeposit?.();
          await showDepositWithdrawModal('deposit');
          return stopResult;
        }
        const result = await showEnableTradingStepsDialog({
          accountStatus: latestPerpsAccountStatus,
          onConfirm: async ({ closeDialog }) => {
            if (shouldIgnoreResult()) {
              return stopResult;
            }
            const didAcceptTerms = await confirmHyperliquidTerms();
            if (!didAcceptTerms || shouldIgnoreResult()) {
              return stopResult;
            }
            return requestEnableTradingWithDepositFallback({
              beforeDeposit: () => {
                closeDialog();
                beforeDeposit?.();
              },
              shouldIgnoreResult,
            });
          },
        });
        return result ?? stopResult;
      }

      const didAcceptTerms = await confirmHyperliquidTerms();
      if (!didAcceptTerms || shouldIgnoreResult()) {
        return stopResult;
      }

      const loadingToast = showLoadingToast
        ? Toast.loading({
            title: intl.formatMessage({
              id: ETranslations.perp_trade_button_enable_trading,
            }),
            duration: Infinity,
          })
        : undefined;
      try {
        return await requestEnableTradingWithDepositFallback({
          beforeDeposit,
          shouldIgnoreResult,
        });
      } finally {
        loadingToast?.close();
      }
    },
    [
      confirmHyperliquidTerms,
      intl,
      perpsAccountStatus,
      requestEnableTradingWithDepositFallback,
      shouldShowEnableTradingDialog,
      showDepositWithdrawModal,
    ],
  );

  const handlePress = useDebouncedCallback(
    async (): Promise<void> => {
      if (!shouldEnableTradingBeforeOrder && !perpsAccountStatus.canTrade) {
        return;
      }

      if (shouldEnableTradingBeforeOrder) {
        const enableTradingAccountKey = perpsAccountKey;
        const shouldIgnoreEnableTradingResult = () =>
          Boolean(
            enableTradingAccountKey &&
            perpsAccountKeyRef.current !== enableTradingAccountKey,
          );
        const result = await requestEmptySizeEnableTrading({
          shouldIgnoreResult: shouldIgnoreEnableTradingResult,
          showLoadingToast: shouldAutoEnableTrading,
        });
        if (!result?.shouldContinue || shouldIgnoreEnableTradingResult()) {
          return;
        }
      }

      const marketDataFreshness = await getLatestPerpsMarketDataFreshness();
      const shouldBlockForMarketData =
        shouldBlockPerpsTradingForMarketData(marketDataFreshness);

      if (shouldBlockForMarketData) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.perp_offline,
          }),
          message: intl.formatMessage({
            id: ETranslations.perps_offline_moblie,
          }),
        });
        return;
      }

      if (
        formData.type === 'limit' &&
        (!formData.price || formData.price.trim() === '')
      ) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.perp_trade_price_place_holder,
          }),
        });
        return;
      }

      Toast.message({
        title: intl.formatMessage(
          { id: ETranslations.perp_size_least },
          { amount: '$10' },
        ),
      });
    },
    1000,
    {
      leading: true,
      trailing: false,
    },
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isMobile) {
        return;
      }
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
        tracePerpsMobileLayout('tradingButton.emptySize.layout', {
          rect,
          side,
          isSpot,
          buttonDisabled,
          isAccountLoading,
          isLiveStatusPending,
        });
        layoutRef.current = rect;
      }
    },
    [
      buttonDisabled,
      isAccountLoading,
      isLiveStatusPending,
      isMobile,
      isSpot,
      side,
    ],
  );

  const button = (
    <Button
      testID={isLong ? PerpTestIDs.LongButton : PerpTestIDs.ShortButton}
      size="medium"
      childrenAsText={false}
      borderRadius="$4"
      bg={buttonStyles.bg}
      hoverStyle={!buttonDisabled ? { bg: buttonStyles.hoverBg } : undefined}
      pressStyle={!buttonDisabled ? { bg: buttonStyles.pressBg } : undefined}
      disabled={buttonDisabled}
      disabledStyle={
        shouldPreserveDisabledButtonStyle ? { opacity: 1 } : undefined
      }
      loading={shouldShowButtonLoading || isSubmitting}
      onPress={handlePress}
      h={36}
    >
      <YStack alignItems="center" gap={2}>
        <SizableText
          size="$bodyMdMedium"
          lineHeight={18}
          color="$textOnColor"
          numberOfLines={1}
        >
          {buttonText}
        </SizableText>
      </YStack>
    </Button>
  );

  if (isMobile) {
    return (
      <YStack gap="$2" flex={1} onLayout={handleLayout}>
        {isSpot ? null : (
          <YStack gap="$1.5">
            <XStack justifyContent="space-between">
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.perp_trade_margin_required,
                })}
                renderTrigger={
                  <DashText
                    size="$bodySm"
                    color="$textSubdued"
                    dashThickness={0.3}
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_cost,
                    })}
                  </DashText>
                }
                renderContent={
                  <YStack px="$5" pb="$4">
                    <SizableText>
                      {intl.formatMessage({
                        id: ETranslations.perp_trade_margin_tooltip,
                      })}
                    </SizableText>
                  </YStack>
                }
              />
              <NumberSizeableText
                size="$bodySm"
                color="$text"
                formatter="value"
                formatterOptions={{ currency: '$' }}
              >
                {0}
              </NumberSizeableText>
            </XStack>

            <XStack justifyContent="space-between">
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.perp_est_liq_price,
                })}
                renderTrigger={
                  <DashText
                    size="$bodySm"
                    color="$textSubdued"
                    dashThickness={0.5}
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_est_liq_price,
                    })}
                  </DashText>
                }
                renderContent={
                  <YStack px="$5" pb="$4">
                    <SizableText>
                      {intl.formatMessage({
                        id: ETranslations.perp_est_liq_price_tooltip,
                      })}
                    </SizableText>
                  </YStack>
                }
              />
              <SizableText size="$bodySm" color="$text">
                --
              </SizableText>
            </XStack>
          </YStack>
        )}
        {button}
      </YStack>
    );
  }

  return (
    <YStack gap="$2" flex={1} onLayout={handleLayout}>
      {button}
      {isSpot ? null : (
        <YStack gap="$1.5">
          <XStack gap="$2" justifyContent={justifyContent}>
            <Tooltip
              placement="top"
              renderContent={intl.formatMessage({
                id: ETranslations.perp_trade_margin_tooltip,
              })}
              renderTrigger={
                <DashText
                  size="$bodySm"
                  color="$textSubdued"
                  cursor="default"
                  dashThickness={0.5}
                >
                  {intl.formatMessage({
                    id: ETranslations.perp_cost,
                  })}
                </DashText>
              }
            />
            <NumberSizeableText
              size="$bodySm"
              color="$text"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {0}
            </NumberSizeableText>
          </XStack>

          <XStack gap="$2" justifyContent={justifyContent}>
            <Tooltip
              placement="top"
              renderContent={intl.formatMessage({
                id: ETranslations.perp_est_liq_price_tooltip,
              })}
              renderTrigger={
                <DashText
                  size="$bodySm"
                  color="$textSubdued"
                  cursor="default"
                  dashThickness={0.5}
                >
                  {intl.formatMessage({
                    id: ETranslations.perp_est_liq_price,
                  })}
                </DashText>
              }
            />
            <SizableText size="$bodySm" color="$text">
              --
            </SizableText>
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}

const SideButtonEmptySize = memo(EmptySizeSideButton);

const TradingButtonGroupConfirmRef = memo(
  ({
    handleConfirmRef,
    marketDataFreshness,
  }: {
    handleConfirmRef: MutableRefObject<
      (overrideSide?: 'long' | 'short') => Promise<void>
    >;
    marketDataFreshness: IPerpsMarketDataFreshness;
  }) => {
    const { handleConfirm } = useOrderConfirmWithMarketDataFreshness({
      marketDataFreshness,
    });

    useLayoutEffect(() => {
      handleConfirmRef.current = handleConfirm;
    }, [handleConfirm, handleConfirmRef]);

    return null;
  },
);
TradingButtonGroupConfirmRef.displayName = 'TradingButtonGroupConfirmRef';

function TradingButtonGroupLive({
  isMobile,
  isLiveStatusPending = false,
  enableTradingModeOverride,
}: ITradingButtonGroupProps) {
  const [tradingMode] = useTradingModeAtom();
  const tradingSide = useTradingFormSide();
  const marketDataFreshness = usePerpsMarketDataFreshness();
  const liveHandleConfirmRef = useRef(noopHandleConfirm);
  const handleConfirm = useCallback(
    (overrideSide?: 'long' | 'short') =>
      liveHandleConfirmRef.current(overrideSide),
    [],
  );
  const isSpot = tradingMode === 'spot';

  const renderSideButtons = () => {
    if (isSpot) {
      return (
        <YStack {...(!isMobile && { mt: '$4' })}>
          <SideButtonLive
            side={tradingSide}
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
          />
        </YStack>
      );
    }
    if (isMobile) {
      return (
        <YStack gap="$3">
          <SideButtonLive
            side="long"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
          />
          <SideButtonLive
            side="short"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
          />
        </YStack>
      );
    }
    return (
      <XStack gap="$2.5" mt="$4">
        <XStack flexBasis="50%" flexShrink={1} overflow="hidden">
          <SideButtonLive
            side="long"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
            justifyContent="flex-start"
          />
        </XStack>
        <XStack flexBasis="50%" flexShrink={1} overflow="hidden">
          <SideButtonLive
            side="short"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
            justifyContent="flex-end"
          />
        </XStack>
      </XStack>
    );
  };

  return (
    <YStack>
      <TradingButtonGroupConfirmRef
        handleConfirmRef={liveHandleConfirmRef}
        marketDataFreshness={marketDataFreshness}
      />
      {renderSideButtons()}
    </YStack>
  );
}

function TradingButtonGroupEmptySize({
  isMobile,
  isLiveStatusPending = false,
  enableTradingModeOverride,
}: ITradingButtonGroupProps) {
  const [tradingMode] = useTradingModeAtom();
  const tradingSide = useTradingFormSide();
  const isSpot = tradingMode === 'spot';

  const renderSideButtons = () => {
    if (isSpot) {
      return (
        <YStack {...(!isMobile && { mt: '$4' })}>
          <SideButtonEmptySize
            side={tradingSide}
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
          />
        </YStack>
      );
    }
    if (isMobile) {
      return (
        <YStack gap="$3">
          <SideButtonEmptySize
            side="long"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
          />
          <SideButtonEmptySize
            side="short"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
          />
        </YStack>
      );
    }
    return (
      <XStack gap="$2.5" mt="$4">
        <XStack flexBasis="50%" flexShrink={1} overflow="hidden">
          <SideButtonEmptySize
            side="long"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
            justifyContent="flex-start"
          />
        </XStack>
        <XStack flexBasis="50%" flexShrink={1} overflow="hidden">
          <SideButtonEmptySize
            side="short"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            enableTradingModeOverride={enableTradingModeOverride}
            justifyContent="flex-end"
          />
        </XStack>
      </XStack>
    );
  };

  return <YStack>{renderSideButtons()}</YStack>;
}

function TradingButtonGroup({
  isMobile,
  isLiveStatusPending = false,
  enableTradingModeOverride,
}: ITradingButtonGroupProps) {
  const formData = useTradingFormEmptySizeParams();

  if (shouldUseEmptySizeTradingButtons(formData)) {
    return (
      <TradingButtonGroupEmptySize
        isMobile={isMobile}
        isLiveStatusPending={isLiveStatusPending}
        enableTradingModeOverride={enableTradingModeOverride}
      />
    );
  }

  return (
    <TradingButtonGroupLive
      isMobile={isMobile}
      isLiveStatusPending={isLiveStatusPending}
      enableTradingModeOverride={enableTradingModeOverride}
    />
  );
}

const TradingButtonGroupMemo = memo(TradingButtonGroup);
export { TradingButtonGroupMemo as TradingButtonGroup };
