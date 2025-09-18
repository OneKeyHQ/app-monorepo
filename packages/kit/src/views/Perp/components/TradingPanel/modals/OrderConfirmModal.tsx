import {
  Dialog,
  NumberSizeableText,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import {
  getTradingButtonStyleProps,
  getTradingSideTextColor,
} from '../../../utils/styleUtils';

interface IShowOrderConfirmParams {
  formData: ITradingFormData;
  tokenName?: string;
  liquidationPrice?: string;
  onConfirm: () => Promise<void>;
}

export function showOrderConfirmDialog({
  formData,
  tokenName = '',
  liquidationPrice,
  onConfirm,
}: IShowOrderConfirmParams) {
  const actionColor = getTradingSideTextColor(formData.side);
  const buttonStyleProps = getTradingButtonStyleProps(formData.side, false);
  const actionText = formData.side === 'long' ? 'Long' : 'Short';

  const getSizeDisplay = () => {
    if (formData.size && tokenName) return `${formData.size} ${tokenName}`;
    return '0';
  };

  const sizeDisplay = getSizeDisplay();

  const OrderContent = () => (
    <YStack gap="$4">
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
            <NumberSizeableText
              size="$bodyMd"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {formData.price}
            </NumberSizeableText>
          )}
        </XStack>

        {/* Liquidation Price */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_position_liq_price,
            })}
          </SizableText>
          {!liquidationPrice ? (
            <SizableText size="$bodyMdMedium">N/A</SizableText>
          ) : (
            <NumberSizeableText
              size="$bodyMdMedium"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {liquidationPrice}
            </NumberSizeableText>
          )}
        </XStack>
      </YStack>
    </YStack>
  );

  Dialog.confirm({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_confirm_order,
    }),
    description: appLocale.intl.formatMessage({
      id: ETranslations.perp_confirm_order_desc,
    }),
    renderContent: <OrderContent />,
    confirmButtonProps: {
      bg: buttonStyleProps.bg,
      hoverStyle: buttonStyleProps.hoverStyle,
      pressStyle: buttonStyleProps.pressStyle,
      color: buttonStyleProps.textColor,
    },
    onConfirm: async () => {
      try {
        await onConfirm();
        Toast.success({
          title: 'Order Placed Successfully',
          message: `${actionText} order for ${sizeDisplay} has been submitted`,
        });
      } catch (error) {
        Toast.error({
          title: 'Order Failed',
          message:
            error instanceof Error ? error.message : 'Failed to place order',
        });
        throw error;
      }
    },
  });
}
