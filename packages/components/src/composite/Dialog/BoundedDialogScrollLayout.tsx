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
 * inside snapPointsMode="fit".
 *
 * `keyboardPaddingBottom` must be the same value DialogFrame applies as
 * paddingBottom — subtract it exactly once. Overflowing email/OTP content
 * is reached by scrolling the Sheet.ScrollView; there is no auto-reveal.
 * Native centered dialogs place this offset outside the card and supply
 * centeredInset for equal clearance above and below the available viewport.
 */
export function BoundedDialogScrollLayout({
  chrome,
  closeButton,
  children,
  keyboardPaddingBottom,
  isCentered = false,
  centeredInset,
}: {
  chrome?: ReactNode;
  closeButton?: ReactNode;
  children: ReactNode;
  keyboardPaddingBottom: number;
  isCentered?: boolean;
  centeredInset?: number;
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

  return (
    <Stack position="relative">
      <DialogScrollView
        testID="dialog-bounded-scroll"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        bounces={false}
        flex={0}
        maxHeight={scrollMaxHeight}
      >
        {children}
      </DialogScrollView>
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
