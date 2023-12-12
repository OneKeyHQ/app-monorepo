import { memo, useCallback } from 'react';
import type { ReactNode } from 'react';

import { Stack } from '../../../primitives';

function CenteredModal({
  children,
  visible,
  disableClose,
  onClose,
}: {
  visible: boolean;
  children?: ReactNode;
  animationType?: 'none' | 'fade' | 'slide';
  disableClose?: boolean;
  onClose?: () => void;
}) {
  const handleBackdropClick = useCallback(() => {
    if (visible && !disableClose) {
      onClose?.();
    }
  }, [disableClose, onClose, visible]);

  return (
    // <Modal transparent animationType={animationType} visible={visible}>
    <Stack
      onPress={handleBackdropClick}
      flex={1}
      $gtMd={{
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Stack
        // Prevents bubbling to prevent the background click event from being triggered when clicking on the modal window
        onPress={(e) => e.stopPropagation()}
        testID="APP-Modal-Screen"
        overflow="hidden"
        width="100%"
        height="100%"
        borderTopStartRadius="$6"
        borderTopEndRadius="$6"
        $gtMd={{
          width: '90%',
          height: '90%',
          maxWidth: '$160',
          maxHeight: '$160',
          borderRadius: '$4',
          outlineWidth: '$px',
          outlineStyle: 'solid',
          outlineColor: '$borderSubdued',
        }}
      >
        {children}
      </Stack>
    </Stack>
  );
}

export default memo(CenteredModal);
