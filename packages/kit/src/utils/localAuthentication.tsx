import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const hasHardwareSupported = () =>
  new Promise<boolean>((resolve) => {
    if (!['ios', 'android'].includes(Platform.OS)) {
      resolve(false);
    } else {
      const p = LocalAuthentication.hasHardwareAsync().then((supported) =>
        LocalAuthentication.isEnrolledAsync().then(
          (isEnrolled) => supported && isEnrolled,
        ),
      );
      resolve(p);
    }
  });

export const localAuthenticate: () => Promise<LocalAuthentication.LocalAuthenticationResult> =
  async () => {
    const supported = await LocalAuthentication.hasHardwareAsync();
    if (!supported) {
      return { success: false, error: 'no supported' };
    }
    return LocalAuthentication.authenticateAsync({
      cancelLabel: 'Cancel',
      // promptMessage: 'Face ID',
    });
  };

export const savePassword = async (password: string) => {
  if (['ios', 'android'].includes(Platform.OS)) {
    await SecureStore.setItemAsync('password', password);
  }
};

export const getPassword = async () => {
  if (['ios', 'android'].includes(Platform.OS)) {
    return SecureStore.getItemAsync('password');
  }
  return null;
};
