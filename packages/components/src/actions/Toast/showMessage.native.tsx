import { toast } from '@backpackapp-io/react-native-toast';

import { View, XStack } from '../../primitives';

import type { IToastMessageOptions } from './type';

export function showMessage({ title, duration }: IToastMessageOptions) {
  toast('', {
    duration,
    customToast: ({ width }) => (
      <XStack alignItems="center" justifyContent="center" width={width}>
        <View bg="$bgApp" px="$4" py="$3" borderRadius="$2" width="60%">
          {title}
        </View>
      </XStack>
    ),
  });
}
