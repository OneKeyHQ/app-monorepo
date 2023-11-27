import { Image } from '../Image';
import { Stack } from '../Stack';

import type { ISplashViewProps } from './SplashView.type';
import type { ImageSourcePropType } from 'react-native';

export function SplashView(props: ISplashViewProps) {
  return (
    <Stack flex={1} justifyContent="center" alignItems="center">
      <Stack w={80} h={80}>
        <Image
          flex={1}
          source={
            {
              uri: require('../../assets/splash.svg'),
              width: '100%',
              height: '100%',
            } as unknown as ImageSourcePropType
          }
        />
      </Stack>
    </Stack>
  );
}
