import { memo, useCallback, useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IOrderResponse,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  formatPriceToSignificantDigits,
  validatePriceInput,
} from '../../utils/tokenUtils';

interface IShowClosePositionParams {
  position: IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];
  assetId: number;
  mid?: string;
  hyperliquidActions: {
    current: {
      marketOrderClose: (params: {
        assetId: number;
        isBuy: boolean;
        size: string;
        midPx: string;
      }) => Promise<IOrderResponse>;
      resetTradingForm: () => void;
    };
  };
}

interface IClosePositionFormProps {
  position: IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];
  size: string;
  onSizeChange: (value: string) => void;
  mid?: string;
}

const ClosePositionForm = memo(
  ({ position, size, onSizeChange, mid }: IClosePositionFormProps) => {
    const currentSize = Math.abs(parseFloat(position.szi || '0'));
    const isLongPosition = parseFloat(position.szi || '0') >= 0;
    const entryPrice = parseFloat(position.entryPx || '0');
    const price = mid ? Number(mid) : 0;

    const handleSizeChange = useCallback(
      (value: string) => {
        if (!validatePriceInput(value)) return;
        const numericValue = parseFloat(value);
        if (numericValue > currentSize) return;
        onSizeChange(value);
      },
      [currentSize, onSizeChange],
    );

    return (
      <YStack gap="$4">
        {/* Position Info */}
        <YStack gap="$3" bg="$bgSubdued" borderRadius="$3" p="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              Current Position
            </SizableText>
            <XStack alignItems="center" space="$2">
              <SizableText
                size="$bodySm"
                color={isLongPosition ? '$textSuccess' : '$textCritical'}
                bg={isLongPosition ? '$green3' : '$red3'}
                px="$2"
                py="$1"
                borderRadius="$2"
              >
                {isLongPosition ? 'Long' : 'Short'}
              </SizableText>
              <SizableText size="$bodyMd" fontWeight="600">
                {currentSize.toFixed(4)} {position.coin}
              </SizableText>
            </XStack>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              Entry Price
            </SizableText>
            <SizableText size="$bodyMd" fontWeight="500">
              $
              {entryPrice > 0
                ? formatPriceToSignificantDigits(entryPrice, 5)
                : '0'}
            </SizableText>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              Price
            </SizableText>
            <SizableText size="$bodyMd" fontWeight="500">
              $
              {price > 0
                ? formatPriceToSignificantDigits(price, 5)
                : 'Loading...'}
            </SizableText>
          </XStack>
        </YStack>

        <Input
          placeholder="Enter size to close"
          value={size}
          onChangeText={handleSizeChange}
          keyboardType="decimal-pad"
          size="medium"
          addOns={[
            {
              renderContent: (
                <XStack alignItems="center" justifyContent="center" pr="$2">
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {position.coin}
                  </SizableText>
                </XStack>
              ),
            },
          ]}
        />
      </YStack>
    );
  },
);
ClosePositionForm.displayName = 'ClosePositionForm';

function ClosePositionContent({
  position,
  assetId,
  mid,
  hyperliquidActions,
  onClose,
}: IShowClosePositionParams & { onClose: () => void }) {
  const [size, setSize] = useState('');

  const actionText = 'Market Close';
  const isLongPosition = parseFloat(position.szi || '0') >= 0;
  const handleConfirm = async () => {
    try {
      if (!size || parseFloat(size) <= 0) {
        throw new OneKeyLocalError({
          message: 'Please enter a valid size',
        });
      }

      if (!mid) {
        throw new OneKeyLocalError({
          message: 'Unable to get current market price',
        });
      }

      await hyperliquidActions.current.marketOrderClose({
        assetId,
        isBuy: isLongPosition,
        size,
        midPx: mid,
      });

      Toast.success({
        title: 'Position Closed Successfully',
        message: `${actionText} for ${size} ${position.coin} has been submitted`,
      });

      // Close dialog after success
      onClose();
    } catch (error) {
      Toast.error({
        title: 'Close Position Failed',
        message:
          error instanceof Error ? error.message : 'Failed to close position',
      });
      throw error;
    }
  };

  return (
    <YStack gap="$6">
      <ClosePositionForm
        position={position}
        size={size}
        onSizeChange={setSize}
        mid={mid}
      />

      {/* Action Buttons */}
      <XStack gap="$3" justifyContent="flex-end" flex={1}>
        <Button
          flex={1}
          variant="primary"
          size="large"
          onPress={handleConfirm}
          disabled={!size || parseFloat(size) <= 0}
        >
          {actionText}
        </Button>
      </XStack>
    </YStack>
  );
}

export function showClosePositionDialog({
  position,
  assetId,
  mid,
  hyperliquidActions,
}: IShowClosePositionParams) {
  const actionText = 'Market Close';

  let dialogInstance: ReturnType<typeof Dialog.show> | null = null;

  const handleClose = () => {
    void dialogInstance?.close();
  };

  dialogInstance = Dialog.show({
    title: actionText,
    description:
      'You pay no gas. The order will be confirmed within a few seconds.',
    renderContent: (
      <ClosePositionContent
        position={position}
        assetId={assetId}
        mid={mid}
        hyperliquidActions={hyperliquidActions}
        onClose={handleClose}
      />
    ),
    showFooter: false,
    onClose: handleClose,
  });

  return dialogInstance;
}
