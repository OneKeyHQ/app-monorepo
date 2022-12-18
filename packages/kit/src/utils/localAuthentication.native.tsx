import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const hasHardwareSupported = () =>
  new Promise<boolean>((resolve) => {
    const p = LocalAuthentication.hasHardwareAsync().then((supported) =>
      LocalAuthentication.isEnrolledAsync().then(
        (isEnrolled) => supported && isEnrolled,
      ),
    );
    resolve(p);
  });

export const localAuthenticate: () => Promise<LocalAuthentication.LocalAuthenticationResult> =
  async () => {
    const supported = await hasHardwareSupported();
    if (!supported) {
      return { success: false, error: 'no supported' };
    }

    return LocalAuthentication.authenticateAsync({
      cancelLabel: 'Cancel',
    });
  };

export const savePassword = (password: string) =>
  SecureStore.setItemAsync('password', password);

export const getPassword = () => SecureStore.getItemAsync('password');
