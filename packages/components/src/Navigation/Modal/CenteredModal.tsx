import { memo } from 'react';
import type { ReactElement } from 'react';

import { Stack } from 'tamagui';

function CenteredModal({
  children,
  visible,
}: {
  visible: boolean;
  children?: ReactElement | ReactElement[];
  animationType?: 'none' | 'fade' | 'slide';
}) {
  return visible ? (
    // <Modal transparent animationType={animationType} visible={visible}>
    <Stack
      testID="APP-Modal-Screen-Backdrop"
      backgroundColor="$bgBackdrop"
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
          width: '$160',
          height: '$160',
          maxWidth: '90%',
          maxHeight: '90%',
          borderRadius: '$2',
        }}
      >
        {children}
      </Stack>
    </Stack>
  ) : null;
}

export default memo(CenteredModal);
