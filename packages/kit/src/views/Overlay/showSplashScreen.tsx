import {
  Image,
  Keyboard,
  Modal,
  NativeModules,
  PixelRatio,
  View,
} from 'react-native';

import splashImage from '@onekeyhq/kit/assets/splash.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showOverlay } from '../../utils/overlayUtils';

export const showSplashScreen = () => {
  if (platformEnv.isNativeIOS) {
    NativeModules.SplashScreenManager.show();
  } else {
    Keyboard.dismiss();
    const width = 1284 / PixelRatio.get();
    const height = 2778 / PixelRatio.get();
    showOverlay(() => (
      <Modal visible animationType="fade">
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Image style={{ width, height }} source={splashImage} />
        </View>
      </Modal>
    ));
  }
};
