import RootSiblingsManager from 'react-native-root-siblings';
import ToastBase, { ToastShowParams } from 'react-native-toast-message';

import { wait } from '@onekeyhq/kit/src/utils/helper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import CustomToast from './Custom';

let toastHolder: RootSiblingsManager | null = null;
type IToastOptions = {
  delay?: number;
};
/*
 toast.show(
        {
          title: intl.formatMessage({ id: 'msg__verification_failure' }),
        },
        {
          type: 'error', // success, error, info
        },
 )
 */
const toastShow = async (
  props: any,
  toastShowParams?: ToastShowParams,
  options?: IToastOptions,
) => {
  // delay should > 600 after navigation changed
  await wait(options?.delay ?? 0);

  if (toastHolder) {
    toastHolder.destroy();
    toastHolder = null;
  }

  setTimeout(() => {
    // auto mount toast container to nearest <RootSiblingParent />
    toastHolder = new RootSiblingsManager(<CustomToast bottomOffset={60} />);
  });

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

export const Toast = { show: toastShow, hide: ToastBase.hide };

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$toast = Toast;
}

export function useToast() {
  return Toast;
}
