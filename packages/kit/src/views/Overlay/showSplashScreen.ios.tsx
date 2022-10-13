import { NativeModules } from 'react-native';

export const showSplashScreen = () => {
  NativeModules.SplashScreenManager.show();
};
