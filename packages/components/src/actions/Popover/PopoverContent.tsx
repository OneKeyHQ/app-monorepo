import { memo, useCallback } from 'react';

import { createPortal } from 'react-dom';
import { useMedia } from 'tamagui';

import { Stack } from '../../primitives';

import type { IPopoverContent } from './type';
import type { GestureResponderEvent } from 'react-native';

function PopoverContentOverlay({
  closePopover,
  isOpen,
}: {
  isOpen?: boolean;
  closePopover: () => void;
}) {
  // On the web platform of md size,
  //  the sheet comes with an overlay component, so there is no need to write another one.
  const { gtMd } = useMedia();
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      closePopover();
      event.stopPropagation();
    },
    [closePopover],
  );
  return gtMd && isOpen
    ? createPortal(
        <Stack
          position={'fixed' as any}
          left={0}
          top={0}
          right={0}
          bottom={0}
          onPress={handlePress}
        />,
        document.body,
      )
    : null;
}

const MemoPopoverContentOverlay = memo(PopoverContentOverlay);

export function PopoverContent({
  children,
  closePopover,
  isOpen,
}: IPopoverContent) {
  return (
    <>
      <MemoPopoverContentOverlay isOpen={isOpen} closePopover={closePopover} />
      {children}
    </>
  );
}
