import React, { forwardRef, useCallback } from 'react';

import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';

import { TBottomBarModalProps } from '../Layout/BottomTabs/types';
import { useThemeValue } from '../Provider/hooks';

const BottomBarModal = forwardRef<
  BottomSheet,
  Omit<TBottomBarModalProps, 'foldableList' | 'tabBarHeight'> & {
    children: React.ReactNode;
  }
  // eslint-disable-next-line react/prop-types
>(({ onOpen, onClose, children }, ref) => {
  console.log('ref', ref);
  const [sheetBgColor] = useThemeValue(['background-default']);
  const handleSheetChanges = useCallback(
    (from: number) => {
      console.log(from);
      setTimeout(() => {
        if (from < 0) {
          onOpen();
        } else {
          onClose();
        }
      });
    },
    [onClose, onOpen],
  );
  const renderBackdrop = useCallback(
    (backdropComponentProps) => (
      <BottomSheetBackdrop
        {...backdropComponentProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const ITEM_COUNT = 3;
  const innerHeight = 72 * ITEM_COUNT + 32 + 56;
  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={[innerHeight]}
      onAnimate={handleSheetChanges}
      onChange={(index) => handleSheetChanges(-index)}
      //   bottomInset={100}
      enablePanDownToClose
      handleComponent={null}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: sheetBgColor }}
    >
      {children}
    </BottomSheet>
  );
});

BottomBarModal.displayName = 'BottomBarModal';

export default BottomBarModal;
