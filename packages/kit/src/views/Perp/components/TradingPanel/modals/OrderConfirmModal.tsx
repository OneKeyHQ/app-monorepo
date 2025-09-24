import { useCallback, useMemo } from 'react';

import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useTradingFormAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsCustomSettingsAtom,
  usePerpsSelectedSymbolAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { useOrderConfirm } from '../../../hooks';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import {
  getTradingButtonStyleProps,
  getTradingSideTextColor,
} from '../../../utils/styleUtils';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';
import { LiquidationPriceDisplay } from '../components/LiquidationPriceDisplay';

interface IOrderConfirmContentProps {
  onClose?: () => void;
}

function OrderConfirmContent({ onClose }: IOrderConfirmContentProps) {
  const { isSubmitting, handleConfirm: confirmOrder } = useOrderConfirm({
    onSuccess: () => {
      onClose?.();
    },
  });
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const [formData] = useTradingFormAtom();
  const [selectedSymbol] = usePerpsSelectedSymbolAtom();
  const actionColor = getTradingSideTextColor(formData.side);
  const buttonStyleProps = getTradingButtonStyleProps(formData.side, false);
  const actionText = formData.side === 'long' ? 'Long' : 'Short';

  const sizeDisplay = useMemo(() => {
    if (formData.size && selectedSymbol?.coin)
      return `${formData.size} ${selectedSymbol.coin}`;
    return '0';
  }, [formData.size, selectedSymbol?.coin]);

  const buttonText = useMemo(() => {
    if (isSubmitting) {
      return appLocale.intl.formatMessage({
        id: ETranslations.perp_trading_button_placing,
      });
    }
    return appLocale.intl.formatMessage({
      id: ETranslations.perp_confirm_order,
    });
  }, [isSubmitting]);

  const setSkipOrderConfirm = useCallback(
    (value: boolean) => {
      setPerpsCustomSettings({
        ...perpsCustomSettings,
        skipOrderConfirm: value,
      });
    },
    [perpsCustomSettings, setPerpsCustomSettings],
  );
  return (
    <YStack gap="$4" p="$1">
      {/* Order Details */}
      <YStack gap="$3">
        {/* Action */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_confirm_order_action,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium" color={actionColor}>
            {actionText}
          </SizableText>
        </XStack>

        {/* Position Size */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_position_position_size,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium">{sizeDisplay}</SizableText>
        </XStack>

        {/* Price */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_orderbook_price,
            })}
          </SizableText>
          {formData.type === 'market' || !formData.price ? (
            <SizableText size="$bodyMdMedium">
              {appLocale.intl.formatMessage({
                id: ETranslations.perp_trade_market,
              })}
            </SizableText>
          ) : (
            <SizableText size="$bodyMd">$ {formData.price}</SizableText>
          )}
        </XStack>

        {/* Liquidation Price */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_position_liq_price,
            })}
          </SizableText>
          <SizableText size="$bodyMd">
            <LiquidationPriceDisplay textSize="$bodyMdMedium" />
          </SizableText>
        </XStack>

        {/* skip order confirm checkbox */}
        <XStack justifyContent="space-between" alignItems="center" gap="$2">
          <Checkbox
            labelProps={{
              fontSize: '$bodyMdMedium',
              color: '$textSubdued',
            }}
            label={appLocale.intl.formatMessage({
              id: ETranslations.perp_confirm_not_show,
            })}
            value={perpsCustomSettings.skipOrderConfirm}
            onChange={(checked) => setSkipOrderConfirm(!!checked)}
          />
        </XStack>
      </YStack>

      <TradingGuardWrapper>
        <Button
          variant="primary"
          size="medium"
          disabled={isSubmitting}
          loading={isSubmitting}
          onPress={confirmOrder}
          {...buttonStyleProps}
        >
          {buttonText}
        </Button>
      </TradingGuardWrapper>
    </YStack>
  );
}

export function showOrderConfirmDialog() {
  const dialogInstance = Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_confirm_order,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <OrderConfirmContent
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
