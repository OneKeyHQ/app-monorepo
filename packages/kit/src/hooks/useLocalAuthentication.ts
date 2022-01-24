import { useCallback, useEffect, useState } from 'react';

import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export function useLocalAuthentication() {
  const [isOk, setOk] = useState(false);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then((supported) => {
      setOk(['ios', 'android'].includes(Platform.OS) && supported);
    });
  }, []);

  const localAuthenticate = useCallback<
    () => Promise<LocalAuthentication.LocalAuthenticationResult>
  >(() => {
    if (!isOk) {
      return Promise.resolve({ success: false, error: 'no supported' });
    }
    return LocalAuthentication.authenticateAsync({
      cancelLabel: 'Cancel',
      promptMessage: 'Face ID',
    });
  }, [isOk]);

  return { isOk, localAuthenticate };
}
