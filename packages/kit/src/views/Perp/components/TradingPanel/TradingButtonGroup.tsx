import { memo, useCallback, useMemo } from 'react';

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
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
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

import { useOrderConfirm } from '../../hooks';
import { useShowDepositWithdrawModal } from '../../hooks/useShowDepositWithdrawModal';
import { useTradingCalculationsForSide } from '../../hooks/useTradingCalculationsForSide';
import { useTradingPrice } from '../../hooks/useTradingPrice';
import { PerpTestIDs } from '../../testIDs';
import { shouldApplyMinimumOrderGuard } from '../../utils/minimumOrderGuard';
import { PERP_TRADE_BUTTON_COLORS } from '../../utils/styleUtils';

import { showOrderConfirmDialog } from './modals/OrderConfirmModal';

interface ITradingButtonGroupProps {
  isMobile: boolean;
}

interface ISideButtonProps {
  side: 'long' | 'short';
  isMobile: boolean;
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
    | undefined;
}

function SideButtonInternal({
  side,
  isMobile,
  justifyContent = 'flex-start',
}: ISideButtonProps) {
  const intl = useIntl();
  const themeVariant = useThemeVariant();
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
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

  const { handleConfirm } = useOrderConfirm();
  const { midPriceBN } = useTradingPrice();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

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

  const buttonDisabled = useMemo(() => {
    return (
      !perpsAccountStatus.canTrade ||
      isAccountLoading ||
      priceError === 'bbo_unavailable' ||
      (perpsAccountStatus.canTrade &&
        (perpConfigCommon?.disablePerpActionPerp ||
          perpConfigCommon?.ipDisablePerp))
    );
  }, [
    perpsAccountStatus.canTrade,
    isAccountLoading,
    priceError,
    perpConfigCommon?.disablePerpActionPerp,
    perpConfigCommon?.ipDisablePerp,
  ]);

  const handleDepositFromToast = useCallback(() => {
    void showDepositWithdrawModal('deposit');
  }, [showDepositWithdrawModal]);

  const showNoEnoughMarginToast = useCallback(() => {
    Toast.error({
      title: isSpot
        ? intl.formatMessage({
            id: ETranslations.dexmarket_insufficient_balance,
          })
        : intl.formatMessage({
            id: ETranslations.perp_insufficient_margin__title,
          }),
      actions: (
        <Button
          testID={PerpTestIDs.MarginToastDepositButton}
          size="small"
          variant="primary"
          onPress={handleDepositFromToast}
        >
          {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
        </Button>
      ),
      actionsAlign: 'left',
      toastId: `perp-no-enough-margin-${isSpot ? 'spot' : 'perp'}`,
    });
  }, [handleDepositFromToast, intl, isSpot]);

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

  const spotTradeSymbol = useMemo(() => {
    if (!isSpot || activeTradeInstrument.mode !== 'spot') {
      return '';
    }
    const u = activeTradeInstrument.universe;
    if (!u) return '';
    return getSpotTokenDisplayName(u.displayName || u.baseName);
  }, [activeTradeInstrument, isSpot]);

  const buttonText = useMemo(() => {
    if (priceError === 'bbo_unavailable')
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
    isSpot,
    side,
    spotTradeSymbol,
    intl,
    perpConfigCommon?.ipDisablePerp,
    perpConfigCommon?.disablePerpActionPerp,
  ]);

  const isLong = side === 'long';
  const isTriggerMode = formData.orderMode === 'trigger';

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
      if (isAccountLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'long' : 'short']
        : colors.dark[isLong ? 'long' : 'short'];
    };

    const getHoverBgColor = () => {
      if (isAccountLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'longHover' : 'shortHover']
        : colors.dark[isLong ? 'longHover' : 'shortHover'];
    };

    const getPressBgColor = () => {
      if (isAccountLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'longPress' : 'shortPress']
        : colors.dark[isLong ? 'longPress' : 'shortPress'];
    };

    return {
      bg: getBgColor(),
      hoverBg: getHoverBgColor(),
      pressBg: getPressBgColor(),
    };
  }, [isAccountLoading, isLong, themeVariant]);

  const handlePress = useDebouncedCallback(
    (): void => {
      // ── Trigger mode validation ──
      if (isTriggerMode && formData.triggerOrderType) {
        const tp = formData.triggerPrice?.trim();
        if (!tp || new BigNumber(tp).lte(0)) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perps_input_trigger_price,
            }),
          });
          return;
        }
        const isLimitTrigger =
          formData.triggerOrderType === ETriggerOrderType.TRIGGER_LIMIT;
        if (isLimitTrigger) {
          const ep = formData.executionPrice?.trim();
          if (!ep || new BigNumber(ep).lte(0)) {
            Toast.message({
              title: intl.formatMessage({
                id: ETranslations.perp_trade_price_place_holder,
              }),
            });
            return;
          }
        }
        if (!midPriceBN.isFinite() || midPriceBN.lte(0)) {
          Toast.error({ title: 'Market price unavailable, please try again' });
          return;
        }
        // Trigger price must differ from current price for TP/SL inference
        if (new BigNumber(tp).eq(midPriceBN)) {
          Toast.error({
            title: 'Trigger price must differ from current price',
          });
          return;
        }
      }

      // Validate empty inputs - show toast instead of disabling button
      // For limit orders (standard mode), check price first
      if (
        !isTriggerMode &&
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
      // Then check size for all order types
      const isSliderMode = formData.sizeInputMode === 'slider';
      const hasSizeEmpty = isSliderMode
        ? !formData.sizePercent || formData.sizePercent <= 0
        : !formData.size || formData.size.trim() === '';
      if (
        hasSizeEmpty ||
        !computedSizeForSide.gt(0) ||
        isMinimumOrderNotMetForSide
      ) {
        let minAmount = '$10';
        if (effectivePriceBN.gt(0)) {
          // minimum token size that satisfies orderValue >= $10
          const minSize = new BigNumber(10)
            .dividedBy(effectivePriceBN)
            .decimalPlaces(szDecimals, BigNumber.ROUND_UP);
          if (resolvedSizeInputUnit === 'token') {
            const coinSymbol = (() => {
              if (isSpot && activeTradeInstrument.mode === 'spot') {
                const u = activeTradeInstrument.universe;
                return u
                  ? getSpotTokenDisplayName(u.displayName || u.baseName)
                  : '';
              }
              return activeAsset?.coin
                ? parseDexCoin(activeAsset.coin).displayName
                : '';
            })();
            minAmount = `${minSize.toFixed(szDecimals)} ${coinSymbol}`;
          } else if (resolvedSizeInputUnit === 'margin') {
            const leverageBN = new BigNumber(leverage || 1);
            if (leverageBN.isFinite() && leverageBN.gt(0)) {
              // SizeInput floors (margin × leverage / price) to szDecimals via
              // formatHlSize, so the smallest margin that produces ≥ `minSize`
              // tokens is exactly `minSize × effectivePrice / leverage`,
              // rounded up to 2 cents to keep the displayed amount on the safe side.
              const minMargin = minSize
                .multipliedBy(effectivePriceBN)
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
        return;
      }

      if (isNoEnoughMargin) {
        showNoEnoughMarginToast();
        return;
      }

      // Validate TPSL only if user has filled in values
      const tpValue = formData.tpValue?.trim();
      const slValue = formData.slValue?.trim();
      const hasTpValue = Boolean(tpValue);
      const hasSlValue = Boolean(slValue);

      if (!isTriggerMode && formData.hasTpsl && (hasTpValue || hasSlValue)) {
        // Calculate trigger prices based on type
        let tpTriggerPrice: BigNumber | null = null;
        let slTriggerPrice: BigNumber | null = null;

        if (hasTpValue && tpValue) {
          if (formData.tpType === 'price') {
            tpTriggerPrice = new BigNumber(tpValue);
          } else {
            // percentage mode
            const percent = new BigNumber(tpValue);
            if (percent.isFinite()) {
              const percentChange = effectivePriceBN
                .multipliedBy(percent)
                .dividedBy(100);
              tpTriggerPrice =
                side === 'long'
                  ? effectivePriceBN.plus(percentChange)
                  : effectivePriceBN.minus(percentChange);
            }
          }
        }

        if (hasSlValue && slValue) {
          if (formData.slType === 'price') {
            slTriggerPrice = new BigNumber(slValue);
          } else {
            // percentage mode
            const percent = new BigNumber(slValue);
            if (percent.isFinite()) {
              const percentChange = effectivePriceBN
                .multipliedBy(percent)
                .dividedBy(100);
              slTriggerPrice =
                side === 'long'
                  ? effectivePriceBN.minus(percentChange)
                  : effectivePriceBN.plus(percentChange);
            }
          }
        }

        // Validate TP only if user filled it
        if (
          hasTpValue &&
          tpTriggerPrice &&
          tpTriggerPrice.isFinite() &&
          effectivePriceBN.gt(0)
        ) {
          if (side === 'long' && tpTriggerPrice.lte(effectivePriceBN)) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_sl,
              }),
              message: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_desc_1,
              }),
            });
            return;
          }
          if (side === 'short' && tpTriggerPrice.gte(effectivePriceBN)) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_sl,
              }),
              message: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_desc_2,
              }),
            });
            return;
          }
        }

        // Validate SL only if user filled it
        if (
          hasSlValue &&
          slTriggerPrice &&
          slTriggerPrice.isFinite() &&
          effectivePriceBN.gt(0)
        ) {
          if (side === 'long' && slTriggerPrice.gte(effectivePriceBN)) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_sl,
              }),
              message: intl.formatMessage({
                id: ETranslations.perp_invaild_sl_desc_1,
              }),
            });
            return;
          }
          if (side === 'short' && slTriggerPrice.lte(effectivePriceBN)) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_invaild_tp_sl,
              }),
              message: intl.formatMessage({
                id: ETranslations.perp_invaild_sl_desc_2,
              }),
            });
            return;
          }
        }
      }

      // Validation passed, proceed with order
      if (perpsCustomSettings.skipOrderConfirm) {
        void handleConfirm(side);
      } else {
        showOrderConfirmDialog({ overrideSide: side, intl });
      }
    },
    1000,
    {
      leading: true,
      trailing: false,
    },
  );
  if (isMobile) {
    return (
      <YStack gap="$2" flex={1}>
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
                    dashColor="$textDisabled"
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
                    dashColor="$textDisabled"
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
    <YStack gap="$2" flex={1}>
      <Button
        testID={isLong ? PerpTestIDs.LongButton : PerpTestIDs.ShortButton}
        size="medium"
        borderRadius="$4"
        bg={buttonStyles.bg}
        hoverStyle={!buttonDisabled ? { bg: buttonStyles.hoverBg } : undefined}
        pressStyle={!buttonDisabled ? { bg: buttonStyles.pressBg } : undefined}
        disabled={buttonDisabled}
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
                  dashColor="$textDisabled"
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
                  dashColor="$textDisabled"
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

function TradingButtonGroup({ isMobile }: ITradingButtonGroupProps) {
  const [tradingMode] = useTradingModeAtom();
  const [formData] = useTradingFormAtom();
  const isSpot = tradingMode === 'spot';

  if (isSpot) {
    return (
      <YStack {...(!isMobile && { mt: '$4' })}>
        <SideButton side={formData.side} isMobile={isMobile} />
      </YStack>
    );
  }

  return isMobile ? (
    <YStack gap="$3">
      <SideButton side="long" isMobile={isMobile} />
      <SideButton side="short" isMobile={isMobile} />
    </YStack>
  ) : (
    <XStack gap="$2.5" mt="$4">
      <XStack flexBasis="50%" flexShrink={1} overflow="hidden">
        <SideButton
          side="long"
          isMobile={isMobile}
          justifyContent="flex-start"
        />
      </XStack>
      <XStack flexBasis="50%" flexShrink={1} overflow="hidden">
        <SideButton
          side="short"
          isMobile={isMobile}
          justifyContent="flex-end"
        />
      </XStack>
    </XStack>
  );
}

const TradingButtonGroupMemo = memo(TradingButtonGroup);
export { TradingButtonGroupMemo as TradingButtonGroup };
