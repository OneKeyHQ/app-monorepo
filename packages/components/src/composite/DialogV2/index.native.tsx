import { useCallback, useMemo, useState } from 'react';

import { BottomSheet, RNHostView } from '@expo/ui';
import {
  createModifier,
  frame,
  interactiveDismissDisabled,
  presentationBackground,
  presentationBackgroundInteraction,
  presentationDetents,
} from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';

import { useThemeName } from '@onekeyhq/components/src/hooks/useStyle';

import { Button, SizableText, Stack, XStack, YStack } from '../../primitives';

import type { IDialogV2Props } from './type';
import type { LayoutChangeEvent } from 'react-native';

/**
 * The sheet itself is the system presentation — corner radius, backdrop, drag
 * physics and the iPad form-sheet variant all come from UIKit, so nothing here
 * styles them. Only the content inside is ours.
 *
 * Height: the first frame presents through the wrapper's fitToContents,
 * then a JS measurement of the content takes over as explicit height
 * detents with a selection. fitToContents alone only gets the
 * presentation-time height right — it feeds SwiftUI through a KVO on the
 * RN root view's bounds, which UIKit does not reliably fire on later
 * re-layouts, so a sheet whose content grows or shrinks never moves. The
 * JS measurement drives detents through props, which always update; and
 * the height change rides a detent-selection change, the one path the
 * system animates.
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
// Top padding from the same wrapper: part of the sheet's visible height.
const SHEET_TOP_PADDING = 16;

// Any snap point turns the wrapper's broken fitToContents measuring off;
// the value itself never wins — the explicit height detent pushed in
// `modifiers` sits later in the list, hence outermost, and overrides it.
const DISABLE_FIT_TO_CONTENTS: ['half'] = ['half'];

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
  const themeName = useThemeName();
  const scheme = themeName.includes('dark') ? 'dark' : 'light';

  // Sheet heights as detents: the current one plus the one before it.
  // Keeping both alive lets the system animate the selection change
  // between them — a plain detent-set replacement snaps with no
  // animation. The trailing detent drops on the next change, so a drag
  // can snap at most one step back.
  const [sheetHeights, setSheetHeights] = useState<{
    prev?: number;
    current: number;
  } | null>(null);
  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.height) + SHEET_TOP_PADDING;
    setSheetHeights((state) => {
      if (!state) return { current: next };
      if (state.current === next) return state;
      return { prev: state.current, current: next };
    });
  }, []);

  const modifiers = useMemo(() => {
    const list = [preferredColorScheme(scheme)];
    if (sheetHeights) {
      // `prev` is only ever set to a height that differs from `current`
      // (the layout handler drops no-op measurements), so its presence is
      // the whole test.
      const detents =
        sheetHeights.prev !== undefined
          ? [{ height: sheetHeights.prev }, { height: sheetHeights.current }]
          : [{ height: sheetHeights.current }];
      list.push(
        presentationDetents(detents, {
          selection: { height: sheetHeights.current },
        }),
      );
    }
    if (background) {
      // Deliberately trades the glass material for opaque paint — the caller
      // asked for a face that does not sample what is behind it.
      list.push(presentationBackground(background));
    }
    if (backgroundInteractive) {
      // Touches pass to the presenting view while the sheet is up (iOS 16.4+).
      list.push(presentationBackgroundInteraction('enabled'));
    }
    if (!dismissible) {
      list.push(interactiveDismissDisabled(true));
    }
    // Outermost on purpose: make the content box exactly the height the
    // sheet offers, and pin the content to its top. The box is otherwise
    // sized by the RN content, so while the sheet animates to a taller
    // detent the box is the bigger of the two and the sheet centres it —
    // the whole stage jumps up and clips for those frames. Pinned, it
    // holds still and the growth simply hangs past the bottom edge until
    // the sheet arrives to reveal it.
    //
    // Both bounds, not just a maximum: a flexible frame given only a
    // maximum never reports smaller than its child, so it inflates and
    // the alignment has nothing left to align. The minimum is what makes
    // it clamp to the offered height instead.
    list.push(frame({ minHeight: 0, maxHeight: Infinity, alignment: 'top' }));
    return list;
  }, [background, backgroundInteractive, dismissible, scheme, sheetHeights]);

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
      snapPoints={sheetHeights ? DISABLE_FIT_TO_CONTENTS : undefined}
      modifiers={modifiers}
    >
      <RNHostView matchContents>
        <YStack
          gap="$4"
          pb="$6"
          width={contentWidth}
          onLayout={handleContentLayout}
        >
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
