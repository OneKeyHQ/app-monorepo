import { useCallback, useMemo } from 'react';

import Toast, { ToastShowParams } from 'react-native-toast-message';

import { ToastProps } from '@onekeyhq/components/src/Toast';

export function useToast() {
  const show = useCallback(
    (props: ToastProps, toastShowParams?: ToastShowParams) => {
      /**
       * Show Toast at next process, avoid toast in modal dismiss issue.
       */
      setTimeout(() => {
        Toast.show({
          type: 'default',
          text1: props.title,
          position: 'bottom',
          ...toastShowParams,
        });
      });
    },
    [],
  );

  const toast = useMemo(() => ({ show }), [show]);
  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    global.$$toast = toast;
  }
  return toast;
}
