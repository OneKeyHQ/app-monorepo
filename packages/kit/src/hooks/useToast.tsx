import ToastBase, { ToastShowParams } from 'react-native-toast-message';

import { ToastProps } from '@onekeyhq/components/src/Toast';

const toastShow = (props: ToastProps, toastShowParams?: ToastShowParams) => {
  /**
   * Show Toast at next process, avoid toast in modal dismiss issue.
   */
  setTimeout(() => {
    ToastBase.show({
      type: 'default',
      text1: props.title,
      position: 'bottom',
      ...toastShowParams,
    });
  });
};

export const Toast = { show: toastShow, hide: ToastBase.hide };

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$toast = Toast;
}

export function useToast() {
  return Toast;
}
