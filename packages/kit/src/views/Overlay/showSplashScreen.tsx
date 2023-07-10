import { Image, Keyboard } from 'react-native';

import { Box } from '@onekeyhq/components';
import splashImage from '@onekeyhq/kit/assets/splash.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showOverlay } from '../../utils/overlayUtils';

export const showSplashScreen = () => {
  Keyboard.dismiss();
  showOverlay(() => (
    <Box
      flex={1}
      justifyContent="center"
      alignItems="center"
      bg="background-default"
    >
      <Image
        style={{
          height: '100%',
          width: '100%',
          resizeMode: platformEnv.isWeb ? 'center' : 'contain',
        }}
        source={splashImage}
      />
    </Box>
  ));
};
