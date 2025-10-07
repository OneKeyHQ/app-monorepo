import { memo, useMemo } from 'react';

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
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useTradingFormAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsCommonConfigPersistAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useOrderConfirm } from '../../hooks';
import { useTradingCalculationsForSide } from '../../hooks/useTradingCalculationsForSide';
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

  const { handleConfirm } = useOrderConfirm();

  const calculations = useTradingCalculationsForSide(side);
  const {
    computedSizeForSide,
    liquidationPrice,
    orderValue,
    marginRequired,
    isNoEnoughMargin,
    effectivePriceBN,
  } = calculations;

  // Check if inputs are empty
  const hasEmptyInputs = useMemo(() => {
    if (
      formData.type === 'limit' &&
      (!formData.price || formData.price.trim() === '')
    ) {
      return true;
    }
    const isSliderMode = formData.sizeInputMode === 'slider';
    if (isSliderMode) {
      return !formData.sizePercent || formData.sizePercent <= 0;
    }
    return !formData.size || formData.size.trim() === '';
  }, [
    formData.type,
    formData.price,
    formData.size,
    formData.sizeInputMode,
    formData.sizePercent,
  ]);

  const isMinimumOrderNotMetForSide = useMemo(() => {
    if (hasEmptyInputs) return false;
    if (!orderValue || !orderValue.isFinite()) return false;
    return orderValue.lt(10);
  }, [hasEmptyInputs, orderValue]);

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
      hasEmptyInputs ||
      !computedSizeForSide.gt(0) ||
      !perpsAccountStatus.canTrade ||
      isMinimumOrderNotMetForSide ||
      isNoEnoughMargin ||
      isAccountLoading ||
      (perpsAccountStatus.canTrade &&
        (perpConfigCommon?.disablePerpActionPerp ||
          perpConfigCommon?.ipDisablePerp))
    );
  }, [
    hasEmptyInputs,
    computedSizeForSide,
    perpsAccountStatus.canTrade,
    isMinimumOrderNotMetForSide,
    isNoEnoughMargin,
    isAccountLoading,
    perpConfigCommon?.disablePerpActionPerp,
    perpConfigCommon?.ipDisablePerp,
  ]);

  const buttonText = useMemo(() => {
    if (isMinimumOrderNotMetForSide)
      return intl.formatMessage(
        {
          id: ETranslations.perp_size_least,
        },
        {
          amount: '$10',
        },
      );
    if (perpConfigCommon?.ipDisablePerp)
      return intl.formatMessage({
        id: ETranslations.perp_button_ip_restricted,
      });
    if (perpConfigCommon?.disablePerpActionPerp)
      return intl.formatMessage({
        id: ETranslations.perp_button_disable_perp,
      });
    if (isNoEnoughMargin)
      return intl.formatMessage({
        id: ETranslations.perp_trading_button_no_enough_margin,
      });
    return side === 'long'
      ? intl.formatMessage({ id: ETranslations.perp_trade_long })
      : intl.formatMessage({ id: ETranslations.perp_trade_short });
  }, [
    isMinimumOrderNotMetForSide,
    isNoEnoughMargin,
    side,
    intl,
    perpConfigCommon?.ipDisablePerp,
    perpConfigCommon?.disablePerpActionPerp,
  ]);

  const isLong = side === 'long';
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
      // Validate TPSL only if user has filled in values
      const tpValue = formData.tpValue?.trim();
      const slValue = formData.slValue?.trim();
      const hasTpValue = Boolean(tpValue);
      const hasSlValue = Boolean(slValue);

      if (formData.hasTpsl && (hasTpValue || hasSlValue)) {
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
        showOrderConfirmDialog(side);
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

            {liquidationPrice ? (
              <NumberSizeableText
                size="$bodySm"
                color="$text"
                formatter="price"
                formatterOptions={{ currency: '$' }}
              >
                {liquidationPrice.toNumber()}
              </NumberSizeableText>
            ) : (
              <SizableText size="$bodySm" color="$text">
                --
              </SizableText>
            )}
          </XStack>
        </YStack>

        <Button
          size="medium"
          borderRadius="$full"
          bg={buttonStyles.bg}
          hoverStyle={
            !buttonDisabled ? { bg: buttonStyles.hoverBg } : undefined
          }
          pressStyle={
            !buttonDisabled ? { bg: buttonStyles.pressBg } : undefined
          }
          disabled={buttonDisabled}
          onPress={handlePress}
        >
          <SizableText size="$bodyMdMedium" color="$textOnColor">
            {buttonText}
          </SizableText>
        </Button>
      </YStack>
    );
  }
  return (
    <YStack gap="$2" flex={1}>
      <Button
        size="medium"
        borderRadius="$full"
        bg={buttonStyles.bg}
        hoverStyle={!buttonDisabled ? { bg: buttonStyles.hoverBg } : undefined}
        pressStyle={!buttonDisabled ? { bg: buttonStyles.pressBg } : undefined}
        disabled={buttonDisabled}
        onPress={handlePress}
      >
        <SizableText size="$bodyMdMedium" color="$textOnColor">
          {buttonText}
        </SizableText>
      </Button>
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

          {liquidationPrice ? (
            <NumberSizeableText
              size="$bodySm"
              color="$text"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {liquidationPrice.toNumber()}
            </NumberSizeableText>
          ) : (
            <SizableText size="$bodySm" color="$text">
              --
            </SizableText>
          )}
        </XStack>
      </YStack>
    </YStack>
  );
}

const SideButton = memo(SideButtonInternal);

function TradingButtonGroup({ isMobile }: ITradingButtonGroupProps) {
  return isMobile ? (
    <YStack gap="$3">
      <SideButton side="long" isMobile={isMobile} />
      <SideButton side="short" isMobile={isMobile} />
    </YStack>
  ) : (
    <XStack gap="$2.5" mt="$4">
      <XStack flexBasis="50%" flexShrink={1}>
        <SideButton
          side="long"
          isMobile={isMobile}
          justifyContent="flex-start"
        />
      </XStack>
      <XStack flexBasis="50%" flexShrink={1}>
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
