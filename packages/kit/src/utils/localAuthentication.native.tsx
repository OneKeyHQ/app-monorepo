import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
} from 'expo-local-authentication';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

export const hasHardwareSupported = () =>
  hasHardwareAsync().then((supported) =>
    isEnrolledAsync().then((isEnrolled) => supported && isEnrolled),
  );

export const localAuthenticate = async () => {
  if (!(await hasHardwareSupported())) {
    return { success: false, error: 'no supported' };
  }

  return authenticateAsync();
};

export const savePassword = (password: string) =>
  setItemAsync('password', password);

export const getPassword = () => getItemAsync('password');
