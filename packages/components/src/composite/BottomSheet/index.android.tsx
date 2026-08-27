import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RNHostView } from '@expo/ui';
import { ModalBottomSheet } from '@expo/ui/jetpack-compose';
import { useWindowDimensions } from 'react-native';

import { useTheme } from '@onekeyhq/components/src/hooks/useStyle';

import { Stack } from '../../primitives';

import type { IBottomSheetProps } from './type';
import type { ModalBottomSheetRef } from '@expo/ui/jetpack-compose';

export type { IBottomSheetProps } from './type';

// Side inset of the shell's content contract, shared with the iOS face.
const CONTENT_SIDE_INSET = 24;
// Stands in for the drag handle's vertical footprint when the handle is
// hidden, so the content never crops against the sheet's top edge.
const CONTENT_TOP_INSET = 16;

/**
 * Android face of the BottomSheet: the Material 3 ModalBottomSheet from
 * @expo/ui/jetpack-compose, used directly instead of the universal wrapper
 * because only the direct component exposes dismiss locking
 * (sheetGesturesEnabled + shouldDismissOnBackPress/ClickOutside), which the
 * dialog's non-dismissible confirming step requires.
 *
 * Height: M3 sizes the sheet to the content's intrinsic height, so the
 * content-sized contract needs none of the iOS face's measuring machinery.
 * Explicit snapPoints are NOT forwarded on purpose: upstream snaps
 * height/fraction stops to the nearest of half/full on Android, which would
 * silently break the caller's height contract — and no current consumer
 * passes them on this platform.
 *
 * backgroundInteractive has no M3 counterpart (the scrim is always modal);
 * the prop is accepted and ignored so cross-platform callers type-check.
 */
export function BottomSheet({
  open,
  onOpenChange,
  children,
  dismissible = true,
  background,
}: IBottomSheetProps) {
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  // ModalBottomSheet presents by being mounted; keep the native view alive
  // through the exit animation (hide() resolves after it) before unmounting.
  //
  // Re-present while hiding: the ref exposes hide()/expand() only — nothing
  // can reverse a dispatched hide. If `open` flips back to true inside the
  // dismiss-animation window (the flow's hide→fast-settle→reveal path),
  // merely staying mounted would leave the sheet invisible forever while
  // React believes it is presented. `presentEpoch` keys the native sheet, so
  // reopening mid-hide retires the hiding instance and mounts a fresh one,
  // which presents cleanly.
  const [mounted, setMounted] = useState(open);
  const [presentEpoch, setPresentEpoch] = useState(0);
  const isHidingRef = useRef(false);
  useEffect(() => {
    if (open) {
      if (isHidingRef.current) {
        isHidingRef.current = false;
        setPresentEpoch((epoch) => epoch + 1);
      }
      setMounted(true);
      return undefined;
    }
    let cancelled = false;
    isHidingRef.current = true;
    void sheetRef.current?.hide().then(() => {
      if (!cancelled) {
        isHidingRef.current = false;
        setMounted(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // The M3 default surface follows the Compose (system) theme, which can
  // disagree with the app theme; paint the container from the app token.
  const theme = useTheme();
  const containerColor = background ?? theme.bgApp.val;
  const { width: windowWidth } = useWindowDimensions();

  const handleDismissRequest = useCallback(() => {
    if (dismissible) {
      onOpenChange(false);
    }
  }, [dismissible, onOpenChange]);
  const windowProperties = useMemo(
    () => ({
      shouldDismissOnBackPress: dismissible,
      shouldDismissOnClickOutside: dismissible,
    }),
    [dismissible],
  );

  if (!mounted) {
    return null;
  }

  return (
    <ModalBottomSheet
      key={presentEpoch}
      ref={sheetRef}
      onDismissRequest={handleDismissRequest}
      showDragHandle={dismissible}
      sheetGesturesEnabled={dismissible}
      properties={windowProperties}
      containerColor={containerColor}
    >
      <RNHostView matchContents>
        <Stack
          width={windowWidth}
          px={CONTENT_SIDE_INSET}
          pt={dismissible ? 0 : CONTENT_TOP_INSET}
        >
          {children}
        </Stack>
      </RNHostView>
    </ModalBottomSheet>
  );
}
