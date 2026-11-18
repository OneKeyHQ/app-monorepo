import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useWindowDimensions } from 'react-native';

import { useSafeAreaInsets } from '../../hooks';
import {
  restoreAndroidSoftInputMode,
  suspendAndroidSoftInputPan,
} from '../../hooks/useKeyboardController';
import { Stack } from '../../primitives';

import { getBoundedDialogScrollMaxHeight } from './boundedDialogLayout';
import { DialogScrollView } from './DialogScrollView';

/**
 * Native-only opt-in body for a Dialog that must stay below the status bar
 * and above the keyboard. Close/grabber chrome is overlaid so it stays
 * reachable while tall content scrolls manually. ScrollView is capped with
 * maxHeight (not height) so a short OAuth sheet still sizes to its content
 * inside the fitted overlay sheet.
 *
 * `keyboardPaddingBottom` must be the same value DialogFrame applies as
 * paddingBottom — subtract it exactly once. Overflowing email/OTP content
 * is reached by scrolling the scroll view; there is no auto-reveal.
 * Native centered dialogs place this offset outside the card and supply
 * centeredInset for equal clearance above and below the available viewport.
 * A caller-provided fixed height pins header/footer slots and lets only the
 * body shrink; the native overlay remains responsible for keyboard movement.
 */
export function BoundedDialogScrollLayout({
  chrome,
  closeButton,
  children,
  keyboardPaddingBottom,
  isCentered = false,
  centeredInset,
  fixedHeaderFooterHeight,
  header,
  footer,
}: {
  chrome?: ReactNode;
  closeButton?: ReactNode;
  children: ReactNode;
  keyboardPaddingBottom: number;
  isCentered?: boolean;
  centeredInset?: number;
  fixedHeaderFooterHeight?: number;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const { top: topInset } = useSafeAreaInsets();
  // Android adjustPan would lift the window on top of Dialog's own keyboard
  // padding. Adjust-nothing while this layout is mounted; restore on leave.
  useEffect(() => {
    suspendAndroidSoftInputPan();
    return () => {
      restoreAndroidSoftInputMode();
    };
  }, []);
  const scrollMaxHeight = getBoundedDialogScrollMaxHeight({
    windowHeight,
    topInset: isCentered ? (centeredInset ?? topInset) : topInset,
    keyboardPaddingBottom,
    isCentered,
  });
  const fixedHeight =
    fixedHeaderFooterHeight !== undefined
      ? Math.min(fixedHeaderFooterHeight, scrollMaxHeight)
      : undefined;

  return (
    <Stack
      testID={fixedHeight === undefined ? undefined : 'dialog-bounded-frame'}
      position="relative"
      height={fixedHeight}
    >
      {header ? <Stack flexShrink={0}>{header}</Stack> : null}
      <DialogScrollView
        testID="dialog-bounded-scroll"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        bounces={false}
        flex={fixedHeight === undefined ? 0 : 1}
        minHeight={fixedHeight === undefined ? undefined : 0}
        maxHeight={fixedHeight === undefined ? scrollMaxHeight : undefined}
      >
        {children}
      </DialogScrollView>
      {footer ? <Stack flexShrink={0}>{footer}</Stack> : null}
      {chrome || closeButton ? (
        <Stack
          testID="dialog-bounded-chrome"
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={2}
          pointerEvents="box-none"
        >
          {chrome}
          {closeButton}
        </Stack>
      ) : null}
    </Stack>
  );
}
