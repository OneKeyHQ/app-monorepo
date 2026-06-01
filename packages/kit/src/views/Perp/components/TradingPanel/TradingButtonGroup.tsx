import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

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
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useActiveTradeInstrumentAtom,
  useTradingFormAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getSpotTokenDisplayName,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  useOrderConfirmWithMarketDataFreshness,
  usePerpsMarketDataFreshness,
} from '../../hooks';
import {
  type IEnableTradingWithDepositFallbackResult,
  useConfirmHyperliquidTerms,
  useRequestEnableTradingWithDepositFallback,
} from '../../hooks/useEnableTradingWithDepositFallback';
import { useTradingCalculationsForSide } from '../../hooks/useTradingCalculationsForSide';
import { useTradingPrice } from '../../hooks/useTradingPrice';
import { PerpTestIDs } from '../../testIDs';
import { shouldApplyMinimumOrderGuard } from '../../utils/minimumOrderGuard';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../../utils/mobileLayoutTrace';
import {
  type IPerpsMarketDataFreshness,
  shouldBlockPerpsTradingForMarketData,
} from '../../utils/perpsMarketDataFreshness';
import {
  getPerpsOrderPanelPostEnableTradingResult,
  shouldBlockPerpsOrderPanelPreEnableTradingForMargin,
  shouldDisablePerpsOrderPanelTradingButton,
  shouldSkipPerpsOrderPanelComputedSizeValidation,
} from '../../utils/perpsOrderPanelEnableTrading';
import { PERP_TRADE_BUTTON_COLORS } from '../../utils/styleUtils';

import { showEnableTradingStepsDialog } from './modals/EnableTradingStepsDialog';
import { showOrderConfirmDialog } from './modals/OrderConfirmModal';

import type { LayoutChangeEvent } from 'react-native';

interface ITradingButtonGroupProps {
  isMobile: boolean;
  isLiveStatusPending?: boolean;
}

interface ISideButtonProps {
  side: 'long' | 'short';
  isMobile: boolean;
  isLiveStatusPending?: boolean;
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

function SideButtonInternal({
  side,
  isMobile,
  isLiveStatusPending = false,
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

  const [isSubmitting] = useTradingLoadingAtom();
  const { midPriceBN } = useTradingPrice();
  const shouldBlockForMarketData =
    shouldBlockPerpsTradingForMarketData(marketDataFreshness);
  const confirmHyperliquidTerms = useConfirmHyperliquidTerms();
  const requestEnableTradingWithDepositFallback =
    useRequestEnableTradingWithDepositFallback();
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
    liquidationPrice: liquidationPriceRaw,
    orderValue,
    marginRequired: marginRequiredRaw,
    isNoEnoughMargin,
    effectivePriceBN,
    priceError,
    leverage,
  } = calculations;

  const marginRequired = useDebounce(marginRequiredRaw, 100);
  const liquidationPrice = useDebounce(liquidationPriceRaw, 100);

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
  const shouldShowButtonLoading = isAccountLoading && !isLiveStatusPending;

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
      enableTradingMode.canAutoEnableInOrderPanel,
    [enableTradingMode.canAutoEnableInOrderPanel, perpsAccountStatus.canTrade],
  );

  const shouldShowEnableTradingDialog = useMemo(
    () =>
      !perpsAccountStatus.canTrade &&
      enableTradingMode.requiresEnableTradingDialogInOrderPanel,
    [
      enableTradingMode.requiresEnableTradingDialogInOrderPanel,
      perpsAccountStatus.canTrade,
    ],
  );

  const shouldEnableTradingBeforeOrder =
    shouldAutoEnableTrading || shouldShowEnableTradingDialog;

  const isTradingStatusDisabled = useMemo(
    () =>
      isLiveStatusPending ||
      (!perpsAccountStatus.canTrade && !shouldEnableTradingBeforeOrder),
    [
      isLiveStatusPending,
      perpsAccountStatus.canTrade,
      shouldEnableTradingBeforeOrder,
    ],
  );

  const buttonDisabled = useMemo(() => {
    return shouldDisablePerpsOrderPanelTradingButton({
      isTradingStatusDisabled,
      shouldEnableTradingBeforeOrder,
      isNoEnoughMargin,
      isAccountLoading,
      isSubmitting,
      hasBboPriceError: priceError === 'bbo_unavailable',
      isServerActionDisabled,
    });
  }, [
    isTradingStatusDisabled,
    shouldEnableTradingBeforeOrder,
    isNoEnoughMargin,
    isAccountLoading,
    isSubmitting,
    priceError,
    isServerActionDisabled,
  ]);

  const buttonSecondaryText = useMemo(() => {
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
  const latestOrderPanelStateRef = useRef({
    activeAsset,
    activeTradeInstrument,
    computedSizeForSide,
    effectivePriceBN,
    formData,
    isMinimumOrderNotMetForSide,
    isNoEnoughMargin,
    isSpot,
    isTriggerMode,
    leverage,
    marketDataFreshness,
    midPriceBN,
    orderContextKey,
    perpsCustomSettings,
    priceError,
    resolvedSizeInputUnit,
    side,
    shouldBlockForMarketData,
    szDecimals,
  });
  latestOrderPanelStateRef.current = {
    activeAsset,
    activeTradeInstrument,
    computedSizeForSide,
    effectivePriceBN,
    formData,
    isMinimumOrderNotMetForSide,
    isNoEnoughMargin,
    isSpot,
    isTriggerMode,
    leverage,
    marketDataFreshness,
    midPriceBN,
    orderContextKey,
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
        isTriggerMode: latestIsTriggerMode,
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

      const tpValue = latestFormData.tpValue?.trim();
      const slValue = latestFormData.slValue?.trim();
      const hasTpValue = Boolean(tpValue);
      const hasSlValue = Boolean(slValue);

      if (
        !latestIsTriggerMode &&
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
        const result = await showEnableTradingStepsDialog({
          accountStatus: perpsAccountStatus,
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
    ],
  );

  const renderLiquidationPrice = () => {
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
  };

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

      const latestOrderPanelState = latestOrderPanelStateRef.current;
      if (
        !validateOrderPanelState({
          orderPanelState: latestOrderPanelState,
          validationSide: side,
          shouldValidateBboPriceError: !shouldEnableTradingBeforeOrder,
        })
      ) {
        return;
      }

      const latestPerpsCustomSettings =
        latestOrderPanelState.perpsCustomSettings;

      if (shouldEnableTradingBeforeOrder) {
        const isDepositRequired =
          perpsAccountStatus.details?.activatedOk === false;
        if (
          shouldBlockPerpsOrderPanelPreEnableTradingForMargin({
            shouldEnableTradingBeforeOrder,
            isNoEnoughMargin: latestOrderPanelState.isNoEnoughMargin,
            isDepositRequired,
          })
        ) {
          Toast.message({
            title: intl.formatMessage({
              id: latestOrderPanelState.isSpot
                ? ETranslations.dexmarket_insufficient_balance
                : ETranslations.perp_trading_button_no_enough_margin,
            }),
          });
          return;
        }

        const enableTradingAccountKey = perpsAccountKey;
        const enableTradingSide = side;
        const enableTradingOrderContextKey =
          latestOrderPanelState.orderContextKey;
        const shouldIgnoreEnableTradingResult = () =>
          Boolean(
            enableTradingAccountKey &&
            perpsAccountKeyRef.current !== enableTradingAccountKey,
          );

        if (!latestPerpsCustomSettings.skipOrderConfirm) {
          showOrderConfirmDialog({
            overrideSide: side,
            intl,
            enableTradingAccountKey,
            enableTradingBeforeConfirm: async ({
              closeDialog,
              shouldIgnoreResult,
            }) => {
              const result = await requestOrderPanelEnableTrading({
                beforeDeposit: closeDialog,
                shouldIgnoreResult,
                showLoadingToast: false,
              });
              const postEnableState = latestOrderPanelStateRef.current;
              const postEnableTradingResult =
                getPerpsOrderPanelPostEnableTradingResult({
                  enableTradingShouldContinue: result.shouldContinue,
                  shouldIgnoreEnableTradingResult: shouldIgnoreResult(),
                  isOrderContextChanged:
                    postEnableState.side !== enableTradingSide ||
                    postEnableState.orderContextKey !==
                      enableTradingOrderContextKey,
                  isNoEnoughMargin: postEnableState.isNoEnoughMargin,
                });
              if (postEnableTradingResult === 'stop') {
                return { ...result, shouldContinue: false };
              }
              if (postEnableTradingResult === 'noEnoughMargin') {
                Toast.message({
                  title: intl.formatMessage({
                    id: postEnableState.isSpot
                      ? ETranslations.dexmarket_insufficient_balance
                      : ETranslations.perp_trading_button_no_enough_margin,
                  }),
                });
                return { ...result, shouldContinue: false };
              }
              if (
                !validateOrderPanelState({
                  orderPanelState: postEnableState,
                  validationSide: side,
                  shouldValidateBboPriceError: true,
                })
              ) {
                return { ...result, shouldContinue: false };
              }
              return result;
            },
          });
          return;
        }

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

        if (
          !validateOrderPanelState({
            orderPanelState: postEnableState,
            validationSide: side,
            shouldValidateBboPriceError: true,
          })
        ) {
          return;
        }
      }

      if (latestPerpsCustomSettings.skipOrderConfirm) {
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

  if (isMobile) {
    return (
      <YStack gap="$2" flex={1} onLayout={handleLayout}>
        {isSpot ? null : (
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
                {marginRequired.toNumber()}
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

              {renderLiquidationPrice()}
            </XStack>
          </YStack>
        )}

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
          loading={shouldShowButtonLoading || isSubmitting}
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
        loading={shouldShowButtonLoading || isSubmitting}
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
      {isSpot ? null : (
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
              {marginRequired.toNumber()}
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

            {renderLiquidationPrice()}
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}

const SideButton = memo(SideButtonInternal);

function TradingButtonGroup({
  isMobile,
  isLiveStatusPending = false,
}: ITradingButtonGroupProps) {
  const [tradingMode] = useTradingModeAtom();
  const [formData] = useTradingFormAtom();
  const marketDataFreshness = usePerpsMarketDataFreshness();
  const { handleConfirm } = useOrderConfirmWithMarketDataFreshness({
    marketDataFreshness,
  });
  const isSpot = tradingMode === 'spot';

  const renderSideButtons = () => {
    if (isSpot) {
      return (
        <YStack {...(!isMobile && { mt: '$4' })}>
          <SideButton
            side={formData.side}
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
          />
        </YStack>
      );
    }
    if (isMobile) {
      return (
        <YStack gap="$3">
          <SideButton
            side="long"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
          />
          <SideButton
            side="short"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
          />
        </YStack>
      );
    }
    return (
      <XStack gap="$2.5" mt="$4">
        <XStack flexBasis="50%" flexShrink={1} overflow="hidden">
          <SideButton
            side="long"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
            justifyContent="flex-start"
          />
        </XStack>
        <XStack flexBasis="50%" flexShrink={1} overflow="hidden">
          <SideButton
            side="short"
            isMobile={isMobile}
            isLiveStatusPending={isLiveStatusPending}
            marketDataFreshness={marketDataFreshness}
            handleConfirm={handleConfirm}
            justifyContent="flex-end"
          />
        </XStack>
      </XStack>
    );
  };

  return <YStack>{renderSideButtons()}</YStack>;
}

const TradingButtonGroupMemo = memo(TradingButtonGroup);
export { TradingButtonGroupMemo as TradingButtonGroup };
