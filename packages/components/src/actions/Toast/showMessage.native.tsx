import { toast } from '@backpackapp-io/react-native-toast';
import { Dimensions } from 'react-native';

import { View, XStack } from '../../primitives';

import type { IToastMessageOptions } from './type';

const GAP = 104;
export function showMessage({ renderContent, duration }: IToastMessageOptions) {
  const windowWidth = Dimensions.get('window').width;
  toast('', {
    width: windowWidth - GAP * 2,
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
          bg="$bgApp"
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
