import { getTime } from 'date-fns';
import RNRestart from 'react-native-restart';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const getTimeStamp = () => getTime(new Date());

export const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const timeout = <T>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms);
    p.then((value) => resolve(value)).catch((err) => reject(err));
  });

export const reload = () => {
  if (platformEnv.isNative) {
    return RNRestart.Restart();
  }
  if (platformEnv.isWeb && typeof window !== 'undefined') {
    return window?.location?.reload?.();
  }
};
