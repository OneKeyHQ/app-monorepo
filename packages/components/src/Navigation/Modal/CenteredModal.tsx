import { memo, useCallback } from 'react';
import type { ReactNode } from 'react';

import { Stack } from '../../Stack';

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
      $md={{
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
      }}
      $gtMd={{
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Stack
        // Prevents bubbling to prevent the background click event from being triggered when clicking on the modal window
        onPress={(e) => e.stopPropagation()}
        flexDirection="column"
        testID="APP-Modal-Screen"
        backgroundColor="$bg"
        overflow="hidden"
        $md={{
          width: '100%',
          height: '100%',
          borderTopStartRadius: '$2',
          borderTopEndRadius: '$2',
        }}
        $gtMd={{
          width: '90%',
          height: '90%',
          maxWidth: '$160',
          maxHeight: '$160',
          borderRadius: '$2',
        }}
      >
        {children}
      </Stack>
    </Stack>
  );
}

export default memo(CenteredModal);
