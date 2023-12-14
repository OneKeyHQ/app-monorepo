import { useCallback } from 'react';

import { Button, XStack } from '../../primitives';

import type { IDialogFooterProps } from './type';
import type { IButtonProps } from '../../primitives';

export function Footer({
  showFooter,
  showCancelButton,
  showConfirmButton,
  cancelButtonProps,
  onConfirm,
  onCancel,
  onConfirmText,
  confirmButtonProps,
  onCancelText,
  tone,
}: IDialogFooterProps) {
  if (!showFooter) {
    return null;
  }
  return (
    <XStack p="$5" pt="$0">
      {showCancelButton ? (
        <Button
          flex={1}
          $md={
            {
              size: 'large',
            } as IButtonProps
          }
          {...cancelButtonProps}
          onPress={onConfirm}
        >
          {onCancelText}
        </Button>
      ) : null}
      {showConfirmButton ? (
        <Button
          variant={tone === 'destructive' ? 'destructive' : 'primary'}
          flex={1}
          ml="$2.5"
          $md={
            {
              size: 'large',
            } as IButtonProps
          }
          {...confirmButtonProps}
          onPress={onCancel}
        >
          {onConfirmText}
        </Button>
      ) : null}
    </XStack>
  );
}
