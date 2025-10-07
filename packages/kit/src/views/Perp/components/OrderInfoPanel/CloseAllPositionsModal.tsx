import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../TradingGuardWrapper';

type ICloseType = 'market' | 'limit';

interface ICloseAllPositionsContentProps {
  onClose?: () => void;
}

function CloseAllPositionsContent({ onClose }: ICloseAllPositionsContentProps) {
  const actions = useHyperliquidActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closeType, setCloseType] = useState<ICloseType>('market');

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await actions.current.closeAllPositions(closeType);
      onClose?.();
    } catch (error) {
      console.error('Close all positions failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [actions, closeType, isSubmitting, onClose]);

  const buttonText = useMemo(() => {
    if (isSubmitting) {
      return 'Closing...';
    }

    if (closeType === 'market') {
      return 'Confirm Market Close';
    }
    return 'Confirm Limit Close';
  }, [closeType, isSubmitting]);

  return (
    <YStack gap="$4" p="$1">
      {/* Description */}
      <SizableText size="$bodyMd" color="$textSubdued">
        This will close all your positions and cancel their associated TP/SL
        orders.
      </SizableText>

      {/* Close Type Options */}
      <YStack>
        {/* Market Close */}
        <XStack>
          <Checkbox
            labelProps={{
              fontSize: '$bodyMd',
            }}
            label="Market Close"
            value={closeType === 'market'}
            onChange={(checked) => {
              if (checked) {
                setCloseType('market');
              }
            }}
          />
        </XStack>

        {/* Limit Close at Mid Price */}
        <XStack>
          <Checkbox
            labelProps={{
              fontSize: '$bodyMd',
            }}
            label="Limit Close at Mid Price"
            value={closeType === 'limit'}
            onChange={(checked) => {
              if (checked) {
                setCloseType('limit');
              }
            }}
          />
        </XStack>
      </YStack>

      <TradingGuardWrapper>
        <Button
          variant="primary"
          size="medium"
          disabled={isSubmitting}
          loading={isSubmitting}
          onPress={handleConfirm}
        >
          {buttonText}
        </Button>
      </TradingGuardWrapper>
    </YStack>
  );
}

export function showCloseAllPositionsDialog() {
  const dialogInstance = Dialog.show({
    title: 'Confirm Close All',
    renderContent: (
      <PerpsProviderMirror>
        <CloseAllPositionsContent
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
