import {
  Dialog,
  NumberSizeableText,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

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
            Action
          </SizableText>
          <SizableText size="$bodyMd" color={actionColor} fontWeight="600">
            {actionText}
          </SizableText>
        </XStack>

        {/* Position Size */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            Position Size
          </SizableText>
          <SizableText size="$bodyMd" fontWeight="500" color={actionColor}>
            {sizeDisplay}
          </SizableText>
        </XStack>

        {/* Price */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            Price
          </SizableText>
          {formData.type === 'market' || !formData.price ? (
            <SizableText size="$bodyMd" fontWeight="500">
              Market
            </SizableText>
          ) : (
            <NumberSizeableText
              size="$bodyMd"
              fontWeight="500"
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
            Liquidation Price
          </SizableText>
          {!liquidationPrice ? (
            <SizableText size="$bodyMd" fontWeight="500">
              N/A
            </SizableText>
          ) : (
            <NumberSizeableText
              size="$bodyMd"
              fontWeight="500"
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
    title: 'Confirm Order',
    description:
      'You pay no gas. The order will be confirmed within a few seconds.',
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
