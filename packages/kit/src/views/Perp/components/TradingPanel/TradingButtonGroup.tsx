import { memo, useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  NumberSizeableText,
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
  isSubmitting: boolean;
}

interface ISideButtonProps {
  side: 'long' | 'short';
  isSubmitting: boolean;
}

function SideButtonInternal({ side, isSubmitting }: ISideButtonProps) {
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
      isSubmitting ||
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
    isSubmitting,
    isMinimumOrderNotMetForSide,
    isNoEnoughMargin,
    isAccountLoading,
    perpConfigCommon?.disablePerpActionPerp,
    perpConfigCommon?.ipDisablePerp,
  ]);

  const buttonText = useMemo(() => {
    if (isSubmitting)
      return intl.formatMessage({
        id: ETranslations.perp_trading_button_placing,
      });
    if (isMinimumOrderNotMetForSide) return 'Order must be at least $10';
    if (isNoEnoughMargin)
      return intl.formatMessage({
        id: ETranslations.perp_trading_button_no_enough_margin,
      });
    return side === 'long'
      ? intl.formatMessage({ id: ETranslations.perp_trade_long })
      : intl.formatMessage({ id: ETranslations.perp_trade_short });
  }, [isSubmitting, isMinimumOrderNotMetForSide, isNoEnoughMargin, side, intl]);

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

  const handlePress = useCallback(() => {
    // Validate TPSL only if user has filled in values
    const hasTpValue = formData.tpValue && formData.tpValue.trim() !== '';
    const hasSlValue = formData.slValue && formData.slValue.trim() !== '';

    if (formData.hasTpsl && (hasTpValue || hasSlValue)) {
      // Calculate trigger prices based on type
      let tpTriggerPrice: BigNumber | null = null;
      let slTriggerPrice: BigNumber | null = null;

      if (hasTpValue) {
        if (formData.tpType === 'price') {
          tpTriggerPrice = new BigNumber(formData.tpValue!);
        } else {
          // percentage mode
          const percent = new BigNumber(formData.tpValue!);
          if (percent.isFinite()) {
            tpTriggerPrice = effectivePriceBN
              .multipliedBy(percent)
              .dividedBy(100)
              .plus(effectivePriceBN);
          }
        }
      }

      if (hasSlValue) {
        if (formData.slType === 'price') {
          slTriggerPrice = new BigNumber(formData.slValue!);
        } else {
          // percentage mode
          const percent = new BigNumber(formData.slValue!);
          if (percent.isFinite()) {
            slTriggerPrice = effectivePriceBN
              .multipliedBy(percent)
              .dividedBy(100)
              .plus(effectivePriceBN);
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
            title: 'Invalid TP/SL',
            message: 'TP must be higher than entry price for long',
          });
          return;
        }
        if (side === 'short' && tpTriggerPrice.gte(effectivePriceBN)) {
          Toast.error({
            title: 'Invalid TP/SL',
            message: 'TP must be lower than entry price for short',
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
            title: 'Invalid TP/SL',
            message: 'SL must be lower than entry price for long',
          });
          return;
        }
        if (side === 'short' && slTriggerPrice.lte(effectivePriceBN)) {
          Toast.error({
            title: 'Invalid TP/SL',
            message: 'SL must be higher than entry price for short',
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
  }, [
    side,
    formData,
    effectivePriceBN,
    perpsCustomSettings.skipOrderConfirm,
    handleConfirm,
  ]);

  return (
    <YStack gap="$2" flex={1}>
      <YStack gap="$1">
        <XStack justifyContent="space-between">
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
        </XStack>

        <XStack justifyContent="space-between">
          <Tooltip
            placement="top"
            renderContent={intl.formatMessage({
              id: ETranslations.perp_trade_margin_tooltip,
            })}
            renderTrigger={
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                cursor="default"
                borderBottomWidth="$px"
                borderTopWidth={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                borderBottomColor="$border"
                borderStyle="dashed"
              >
                {intl.formatMessage({
                  id: ETranslations.perp_trade_margin_required,
                })}
              </SizableText>
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
          <Tooltip
            placement="top"
            renderContent={intl.formatMessage({
              id: ETranslations.perp_est_liq_price_tooltip,
            })}
            renderTrigger={
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                cursor="default"
                borderBottomWidth="$px"
                borderTopWidth={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                borderBottomColor="$border"
                borderStyle="dashed"
              >
                {intl.formatMessage({
                  id: ETranslations.perp_est_liq_price,
                })}
              </SizableText>
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
        borderRadius="$3"
        bg={buttonStyles.bg}
        hoverStyle={
          !buttonDisabled && !isSubmitting
            ? { bg: buttonStyles.hoverBg }
            : undefined
        }
        pressStyle={
          !buttonDisabled && !isSubmitting
            ? { bg: buttonStyles.pressBg }
            : undefined
        }
        loading={isSubmitting}
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

const SideButton = memo(SideButtonInternal);

function TradingButtonGroup({ isSubmitting }: ITradingButtonGroupProps) {
  return (
    <YStack gap="$3">
      <SideButton side="long" isSubmitting={isSubmitting} />
      <SideButton side="short" isSubmitting={isSubmitting} />
    </YStack>
  );
}

const TradingButtonGroupMemo = memo(TradingButtonGroup);
export { TradingButtonGroupMemo as TradingButtonGroup };
