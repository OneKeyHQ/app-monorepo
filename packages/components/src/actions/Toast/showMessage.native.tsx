import { toast } from '@backpackapp-io/react-native-toast';

import { View, XStack } from '../../primitives';

import type { IToastMessageOptions } from './type';

export function showMessage({ renderContent, duration }: IToastMessageOptions) {
  toast('', {
    duration,
    disableShadow: true,
    customToast: ({ width }) => (
      <XStack
        alignItems="center"
        justifyContent="center"
        alignSelf="center"
        width={width}
      >
        <View
          bg="$bg"
          px="$4"
          py="$3"
          borderRadius="$2"
          shadowColor="#181821"
          shadowOffset={{
            width: 0,
            height: 3,
          }}
          shadowOpacity={0.15}
          shadowRadius={4.65}
          elevationAndroid={7}
        >
          {renderContent({ width })}
        </View>
      </XStack>
    ),
  });
}
