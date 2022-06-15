import ToastBase, { ToastShowParams } from 'react-native-toast-message';

const toastShow = (props: any, toastShowParams?: ToastShowParams) => {
  /**
   * Show Toast at next process, avoid toast in modal dismiss issue.
   *
   * Sometime when native Modal close, JS event-loop will not trigger Toast show, need a delay time.
   */
  setTimeout(() => {
    ToastBase.show({
      type: 'default',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      text1: props.title,
      position: 'top',
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
