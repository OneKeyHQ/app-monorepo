import { Image, Keyboard, Modal, NativeModules, View } from 'react-native';

import splashImage from '@onekeyhq/kit/assets/splash.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showOverlay } from '../../utils/overlayUtils';

export const showSplashScreen = () => {
  if (platformEnv.isNativeIOS) {
    NativeModules.SplashScreenManager.show();
  } else {
    Keyboard.dismiss();
    showOverlay(() => (
      <Modal visible animationType="fade">
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Image
            style={{
              height: '100%',
              width: '100%',
              resizeMode: platformEnv.isWeb ? 'center' : 'contain',
            }}
            source={splashImage}
          />
        </View>
      </Modal>
    ));
  }
};
