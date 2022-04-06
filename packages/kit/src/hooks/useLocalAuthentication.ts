import { useCallback, useEffect, useState } from 'react';

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Keyboard, Platform } from 'react-native';

export function useLocalAuthentication() {
  const [isOk, setOk] = useState(false);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then((supported) => {
      LocalAuthentication.isEnrolledAsync().then((isEnrolled) => {
        setOk(
          ['ios', 'android'].includes(Platform.OS) && supported && isEnrolled,
        );
      });
    });
  }, []);

  const localAuthenticate = useCallback<
    () => Promise<LocalAuthentication.LocalAuthenticationResult>
  >(async () => {
    const supported = await LocalAuthentication.hasHardwareAsync();
    if (!supported) {
      return { success: false, error: 'no supported' };
    }
    Keyboard.dismiss();
    return LocalAuthentication.authenticateAsync({
      cancelLabel: 'Cancel',
      // promptMessage: 'Face ID',
    });
  }, []);

  const savePassword = useCallback(async (password: string) => {
    if (['ios', 'android'].includes(Platform.OS)) {
      await SecureStore.setItemAsync('password', password);
    }
  }, []);

  const getPassword = useCallback(async () => {
    if (['ios', 'android'].includes(Platform.OS)) {
      return SecureStore.getItemAsync('password');
    }
    return null;
  }, []);

  return { isOk, localAuthenticate, savePassword, getPassword };
}
