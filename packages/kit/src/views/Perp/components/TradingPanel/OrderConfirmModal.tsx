import {
  YStack,
  XStack,
  SizableText,
  Dialog,
  Toast,
} from '@onekeyhq/components';

import type { ITradingFormData } from '../../../../states/jotai/contexts/hyperliquid';

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
  const buttonColor = formData.side === 'long' ? '$green9' : '$red9';
  const actionText = formData.side === 'long' ? 'Long' : 'Short';

  const priceDisplay = formData.type === 'market' 
    ? 'Market' 
    : formData.price ? `$${parseFloat(formData.price).toLocaleString()}` : 'Market';

  const sizeDisplay = formData.size && tokenName 
    ? `${formData.size} ${tokenName}` 
    : '0';

  const liquidationDisplay = liquidationPrice 
    ? `$${parseFloat(liquidationPrice).toLocaleString()}` 
    : 'N/A';

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
    description: 'You pay no gas. The order will be confirmed within a few seconds.',
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
          message: error instanceof Error ? error.message : 'Failed to place order',
        });
        throw error; // Re-throw to let Dialog handle it
      }
    },
  });
}
