import { useCallback, useRef } from 'react';

import { NativeSheet } from '@onekeyfe/react-native-native-sheet';

import { useTheme } from '../../hooks/useStyle';

import { getNativeSheetBackdropDimAmount } from './backdrop';

import type { INativeSheetPresentationProps } from './types';

export const NATIVE_SHEET_PRESENTATION_SUPPORTED = true;

export function NativeSheetPresentation({
  open,
  onOpenChange,
  dimAmount,
  backgroundColor,
  ...props
}: INativeSheetPresentationProps) {
  const theme = useTheme();
  const openRef = useRef(open);
  openRef.current = open;
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && openRef.current) {
        onOpenChange?.(false);
      }
    },
    [onOpenChange],
  );
  const resolvedDimAmount =
    dimAmount ?? getNativeSheetBackdropDimAmount(String(theme.bgBackdrop.val));
  return (
    <NativeSheet
      {...props}
      open={open}
      onOpenChange={handleOpenChange}
      dimAmount={resolvedDimAmount}
      backgroundColor={backgroundColor ?? String(theme.bg.val)}
    />
  );
}
