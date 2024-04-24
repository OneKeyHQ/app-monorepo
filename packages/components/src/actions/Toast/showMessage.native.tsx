import { toast } from '@backpackapp-io/react-native-toast';

import { View, XStack } from '../../primitives';

import type { IToastMessageOptions } from './type';

export function showMessage({ title, duration }: IToastMessageOptions) {
  toast('', {
    duration,
    disableShadow: true,
    customToast: ({ width }) => (
      <XStack alignItems="center" justifyContent="center" width={width}>
        <View
          bg="$bgApp"
          px="$4"
          py="$3"
          borderRadius="$2"
          width="60%"
          shadowColor="#181821"
          shadowOffset={{
            width: 0,
            height: 3,
          }}
          shadowOpacity={0.15}
          shadowRadius={4.65}
          elevationAndroid={7}
        >
          {title}
        </View>
      </XStack>
    ),
  });
}
