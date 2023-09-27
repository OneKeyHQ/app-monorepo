import type { ReactElement } from 'react';

import { Modal } from 'react-native';
import { Stack } from 'tamagui';

export default function CenteredModal({
  children,
  visible,
  animationType = 'fade',
}: {
  visible: boolean;
  children?: ReactElement | ReactElement[];
  animationType?: 'none' | 'fade' | 'slide';
}) {
  return (
    <Modal
      testID="APP-Modal-Screen"
      transparent
      animationType={animationType}
      visible={visible}
    >
      <Stack
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
    </Modal>
  );
}
