import { memo } from 'react';

import { createPortal } from 'react-dom';

import { Stack } from '../../primitives';

import type { IPopoverContent } from './type';

function PopoverContentOverlay({
  closePopover,
  isOpen,
}: {
  isOpen?: boolean;
  closePopover: () => void;
}) {
  return isOpen
    ? createPortal(
        <Stack
          position={'fixed' as any}
          left={0}
          top={0}
          right={0}
          bottom={0}
          onPress={closePopover}
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
