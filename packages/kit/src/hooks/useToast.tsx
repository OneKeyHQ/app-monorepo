import { useCallback, useMemo } from 'react';

import Toast from 'react-native-toast-message';

import { ToastProps } from '@onekeyhq/components/src/Toast';

export function useToast() {
  const show = useCallback((props: ToastProps) => {
    setTimeout(() => {
      Toast.show({
        type: 'default',
        text1: props.title,
        position: 'bottom',
      });
    }, 500);
  }, []);

  const toast = useMemo(() => ({ show }), [show]);
  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    global.$$toast = toast;
  }
  return toast;
}
