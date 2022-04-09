import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Keyboard, Platform } from 'react-native';

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
    // sometimes, the users turn on faceid  with the focus of the input box,
    // in that case, if faceid is turned on before the keyboard is hidden,
    // after faceid finished, the keyboard will always be there. there is no way to turn it off.
    Keyboard.dismiss();
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
