import { useCallback, useMemo } from 'react';

import { BottomSheet, RNHostView } from '@expo/ui';
import {
  createModifier,
  interactiveDismissDisabled,
  presentationBackground,
} from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';

import { useThemeName } from '@onekeyhq/components/src/hooks/useStyle';

import { Button, SizableText, Stack, XStack, YStack } from '../../primitives';

import type { IDialogV2Props } from './type';

/**
 * The sheet itself is the system presentation — corner radius, backdrop, drag
 * physics and the iPad form-sheet variant all come from UIKit, so nothing here
 * styles them. Only the content inside is ours.
 *
 * Height is left to the sheet: with no snap points it sizes to its content.
 *
 * One exception to "the system styles the chrome": the system draws it against
 * its own appearance, blind to the Tamagui context, so a subtree pinned with
 * <Theme name="dark"> would get dark content on a light sheet. Mirroring the
 * ambient scheme into the presentation is the native counterpart of the
 * data-theme stamp on the web portal — and it must go through SwiftUI's
 * preferredColorScheme, which flows up to the enclosing presentation and
 * restyles the sheet chrome in place, material intact. The two in-package
 * levers both fall short: environment(colorScheme) stops at the content
 * subtree, and a presentationBackground fill replaces the glass material
 * with flat paint. The registry entry ships in our @expo/ui patch; upstream
 * has no TS helper for it, so the config is built directly.
 */

const preferredColorScheme = (value: 'light' | 'dark') =>
  createModifier('preferredColorScheme', { colorScheme: value });

// Side padding the universal BottomSheet wrapper puts around its content.
const SHEET_SIDE_PADDING = 16;

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
}: IDialogV2Props) {
  const themeName = useThemeName();
  const scheme = themeName.includes('dark') ? 'dark' : 'light';

  const modifiers = useMemo(() => {
    const list = [preferredColorScheme(scheme)];
    if (background) {
      // Deliberately trades the glass material for opaque paint — the caller
      // asked for a face that does not sample what is behind it.
      list.push(presentationBackground(background));
    }
    if (!dismissible) {
      list.push(interactiveDismissDisabled(true));
    }
    return list;
  }, [background, dismissible, scheme]);

  // The host frame spans the sheet but aligns its content topLeading with
  // 16pt side padding (the universal BottomSheet wrapper), and the RN content
  // is measured intrinsically — without an explicit width the column collapses
  // to its widest child and everything hangs left, jumping as titles change.
  // Fill the padded frame instead; on iPhone the sheet spans the window. iPad
  // form sheets are narrower and will need the real container width if the
  // exploration ever goes there.
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - 2 * SHEET_SIDE_PADDING;

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
      modifiers={modifiers}
    >
      <RNHostView matchContents>
        <YStack gap="$4" pb="$6" width={contentWidth}>
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
