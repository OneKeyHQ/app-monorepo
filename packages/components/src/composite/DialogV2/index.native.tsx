import { useCallback } from 'react';

import { Button, SizableText, Stack, XStack, YStack } from '../../primitives';
import { BottomSheet } from '../BottomSheet';

import type { IDialogV2Props } from './type';

/**
 * Dialog semantics over the system sheet: the header, the footer actions and
 * their close-on-press contract. Presentation — system chrome, content-sized
 * height, theme mirroring — is ../BottomSheet's job, shared with any other
 * surface that presents as a sheet.
 */
export function DialogV2({
  open,
  onOpenChange,
  title,
  description,
  children,
  tone = 'default',
  confirmText,
  onConfirm,
  cancelText,
  onCancel,
  dismissible = true,
  background,
  backgroundInteractive,
}: IDialogV2Props) {
  const handleConfirm = useCallback(() => {
    onConfirm?.();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const hasHeader = Boolean(title) || Boolean(description);
  const hasFooter = Boolean(confirmText) || Boolean(cancelText);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      dismissible={dismissible}
      background={background}
      backgroundInteractive={backgroundInteractive}
    >
      <YStack gap="$4" pb="$6">
        {hasHeader ? (
          <YStack gap="$2">
            {title ? (
              <SizableText size="$headingLg">{title}</SizableText>
            ) : null}
            {description ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {description}
              </SizableText>
            ) : null}
          </YStack>
        ) : null}
        {children ? <Stack>{children}</Stack> : null}
        {hasFooter ? (
          <XStack gap="$2.5" jc="flex-end">
            {cancelText ? (
              <Button testID="dialog-v2-cancel" onPress={handleCancel}>
                {cancelText}
              </Button>
            ) : null}
            {confirmText ? (
              <Button
                testID="dialog-v2-confirm"
                variant={tone === 'destructive' ? 'destructive' : 'primary'}
                onPress={handleConfirm}
              >
                {confirmText}
              </Button>
            ) : null}
          </XStack>
        ) : null}
      </YStack>
    </BottomSheet>
  );
}
