import { toast } from '@backpackapp-io/react-native-toast';
import { Dimensions } from 'react-native';

import { View, XStack } from '../../primitives';

import type { IToastMessageOptions } from './type';

const GAP = 88;
export function showMessage({ title, duration }: IToastMessageOptions) {
  toast('', {
    duration,
    disableShadow: true,
    customToast: () => {
      const windowWidth = Dimensions.get('window').width;
      console.log('windowWidth', windowWidth);
      return (
        <XStack
          alignItems="center"
          justifyContent="center"
          alignSelf="center"
          width={windowWidth - GAP * 2}
          left={GAP}
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
            {title}
          </View>
        </XStack>
      );
    },
  });
}
