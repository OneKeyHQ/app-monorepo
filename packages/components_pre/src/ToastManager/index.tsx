import ToastBase from 'react-native-toast-message';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ToastShowParams } from 'react-native-toast-message';

/*
 ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__verification_failure' }),
        },
        {
          type: ToastManagerType.error, // success, error, info
        },
 )
 */

export enum ToastManagerType {
  default = 'default',
  success = 'success',
  error = 'error',
}

interface ToastManagerShowParams extends ToastShowParams {
  type?: ToastManagerType;
}

const toastShow = (
  props: Record<string | 'title', any>,
  toastShowParams?: ToastManagerShowParams,
) => {
  /**
   * Show Toast at next process, avoid toast in modal dismiss issue.
   *
   * Sometime when native Modal close, JS event-loop will not trigger Toast show, need a delay time.
   */
  setTimeout(() => {
    ToastBase.show({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      text1: props.title,
      type: 'success', // success, error, info
      position: 'top',
      topOffset: platformEnv.isNativeIOS ? 64 : 40,
      props,
      ...toastShowParams,
    });
  }, 50);
};

const ToastManager = { show: toastShow, hide: ToastBase.hide };

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$toast = ToastManager;
}
export default ToastManager;
