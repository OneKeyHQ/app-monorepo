import { memo, useCallback, useMemo } from 'react';

import { createPortal } from 'react-dom';
import { useMedia } from 'tamagui';

import { SHEET_POPOVER_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { Stack } from '../../primitives';

import type { IPopoverContent } from './type';
import type { GestureResponderEvent } from 'react-native';

function PopoverContentOverlay({
  closePopover,
  isOpen,
  keepChildrenMounted,
}: {
  isOpen?: boolean;
  closePopover: () => void;
  keepChildrenMounted?: boolean;
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
  const element = useMemo(() => {
    const content = (
      <Stack
        zIndex={keepChildrenMounted ? undefined : SHEET_POPOVER_Z_INDEX}
        testID="ovelay-popover"
        position={keepChildrenMounted ? ('fixed' as any) : 'absolute'}
        left={0}
        top={0}
        right={0}
        bottom={0}
        pointerEvents="box-only"
        onPress={handlePress}
      />
    );
    return createPortal(content, document.body);
  }, [handlePress, keepChildrenMounted]);
  return gtMd && isOpen ? element : null;
}

const MemoPopoverContentOverlay = memo(PopoverContentOverlay);

export function PopoverContent({
  keepChildrenMounted,
  children,
  closePopover,
  isOpen,
}: IPopoverContent & { keepChildrenMounted?: boolean }) {
  return (
    <>
      <MemoPopoverContentOverlay
        isOpen={isOpen}
        closePopover={closePopover}
        keepChildrenMounted={keepChildrenMounted}
      />
      {children}
    </>
  );
}
