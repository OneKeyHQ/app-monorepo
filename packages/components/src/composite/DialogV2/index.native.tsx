import { useCallback } from 'react';

import { BottomSheet, RNHostView } from '@expo/ui';
import { interactiveDismissDisabled } from '@expo/ui/swift-ui/modifiers';

import { Button, SizableText, Stack, XStack, YStack } from '../../primitives';

import type { IDialogV2Props } from './type';

/**
 * The sheet itself is the system presentation — corner radius, backdrop, drag
 * physics and the iPad form-sheet variant all come from UIKit, so nothing here
 * styles them. Only the content inside is ours.
 *
 * Height is left to the sheet: with no snap points it sizes to its content.
 */

// There is no prop for blocking dismissal; the SwiftUI modifier is the only
// lever, and it must be a stable reference to satisfy the react-perf rules.
const BLOCK_DISMISS = [interactiveDismissDisabled(true)];

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
}: IDialogV2Props) {
  const handleDismiss = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

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
      isPresented={open}
      onDismiss={handleDismiss}
      showDragIndicator={dismissible}
      modifiers={dismissible ? undefined : BLOCK_DISMISS}
    >
      <RNHostView matchContents>
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
      </RNHostView>
    </BottomSheet>
  );
}
