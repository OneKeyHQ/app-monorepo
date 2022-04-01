import { useCallback } from 'react';

import Toast from 'react-native-toast-message';

import { ToastProps } from '@onekeyhq/components/src/Toast';

export function useToast() {
  const info = useCallback(
    (text: string) =>
      Toast.show({
        type: 'default',
        text1: text,
        position: 'bottom',
      }),
    [],
  );
  const show = useCallback(
    (props: ToastProps) =>
      Toast.show({
        type: 'default',
        text1: props.title,
        position: 'bottom',
      }),
    [],
  );

  const toast = { info, show };
  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    global.$$toast = toast;
  }
  return toast;
}
