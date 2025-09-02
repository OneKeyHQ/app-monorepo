import {
  Dialog,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

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
  const actionColor = formData.side === 'long' ? '$green10' : '$red10';
  const actionText = formData.side === 'long' ? 'Long' : 'Short';

  const getPriceDisplay = () => {
    if (formData.type === 'market') return 'Market';
    if (formData.price)
      return `$${parseFloat(formData.price).toLocaleString()}`;
    return 'Market';
  };

  const getSizeDisplay = () => {
    if (formData.size && tokenName) return `${formData.size} ${tokenName}`;
    return '0';
  };

  const getLiquidationDisplay = () => {
    if (liquidationPrice)
      return `$${parseFloat(liquidationPrice).toLocaleString()}`;
    return 'N/A';
  };

  const priceDisplay = getPriceDisplay();
  const sizeDisplay = getSizeDisplay();
  const liquidationDisplay = getLiquidationDisplay();

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
          <SizableText size="$bodyMd" fontWeight="500">
            {sizeDisplay}
          </SizableText>
        </XStack>

        {/* Price */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            Price
          </SizableText>
          <SizableText size="$bodyMd" fontWeight="500">
            {priceDisplay}
          </SizableText>
        </XStack>

        {/* Liquidation Price */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            Liquidation Price
          </SizableText>
          <SizableText size="$bodyMd" fontWeight="500">
            {liquidationDisplay}
          </SizableText>
        </XStack>
      </YStack>
    </YStack>
  );

  Dialog.confirm({
    title: 'Confirm Order',
    description:
      'You pay no gas. The order will be confirmed within a few seconds.',
    renderContent: <OrderContent />,
    onConfirm: async () => {
      try {
        await onConfirm();

        // Show success notification
        Toast.success({
          title: 'Order Placed Successfully',
          message: `${actionText} order for ${sizeDisplay} has been submitted`,
        });
      } catch (error) {
        // Show error notification
        Toast.error({
          title: 'Order Failed',
          message:
            error instanceof Error ? error.message : 'Failed to place order',
        });
        throw error; // Re-throw to let Dialog handle it
      }
    },
  });
}
