import { useCallback, useMemo, useRef } from 'react';

import {
  OverlayView,
  useNestedOverlayLevel,
} from '@onekeyfe/react-native-native-overlay';

import { useTheme } from '../../hooks/useStyle';

import type { INativeSheetPresentationProps } from './types';
import type {
  IOverlayBackdrop,
  IOverlaySheetOptions,
} from '@onekeyfe/react-native-native-overlay';

export const NATIVE_SHEET_PRESENTATION_SUPPORTED = true;

export function NativeSheetPresentation({
  open,
  onOpenChange,
  onAnimationComplete,
  height,
  maxHeight,
  dismissOnOverlayPress,
  dismissOnSnapToBottom,
  disableDrag = false,
  dismissOnBackPress,
  showHandle = true,
  cornerRadius = 32,
  dimAmount,
  backgroundColor,
  testID,
  children,
}: INativeSheetPresentationProps) {
  const theme = useTheme();
  const openRef = useRef(open);
  openRef.current = open;

  const requestClose = useCallback(() => {
    if (openRef.current) {
      onOpenChange?.(false);
    }
  }, [onOpenChange]);

  const backdrop = useMemo<IOverlayBackdrop>(
    () => ({
      // The theme backdrop already carries its alpha; an explicit dimAmount
      // keeps the legacy black-with-alpha behavior.
      color:
        dimAmount === undefined
          ? String(theme.bgBackdrop.val)
          : `rgba(0, 0, 0, ${dimAmount})`,
      dismissOnPress: dismissOnOverlayPress ?? false,
    }),
    [dimAmount, dismissOnOverlayPress, theme.bgBackdrop.val],
  );

  const sheet = useMemo<IOverlaySheetOptions>(
    () => ({
      height,
      maxHeight,
      cornerRadius,
      showHandle,
      backgroundColor: backgroundColor ?? String(theme.bg.val),
      dismissOnPanDown: !disableDrag && (dismissOnSnapToBottom ?? true),
    }),
    [
      backgroundColor,
      cornerRadius,
      disableDrag,
      dismissOnSnapToBottom,
      height,
      maxHeight,
      showHandle,
      theme.bg.val,
    ],
  );

  const level = useNestedOverlayLevel();
  const onPresented = useCallback(
    () => onAnimationComplete?.({ open: true }),
    [onAnimationComplete],
  );
  const onClose = useCallback(() => {
    requestClose();
    onAnimationComplete?.({ open: false });
  }, [onAnimationComplete, requestClose]);

  return (
    <OverlayView
      visible={open}
      level={level}
      presentation="sheet"
      sheet={sheet}
      // Callers (Popover) measure the content before they set `open`.
      keepContentMounted
      backdrop={backdrop}
      dismissOnBackPress={dismissOnBackPress ?? true}
      onRequestDismiss={requestClose}
      onPresented={onPresented}
      onClose={onClose}
      testID={testID}
    >
      {children}
    </OverlayView>
  );
}
