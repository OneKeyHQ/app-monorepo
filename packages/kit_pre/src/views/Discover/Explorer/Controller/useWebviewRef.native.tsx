import { useCallback } from 'react';

import type { OnWebviewNavigation } from '../explorerUtils';
import type { WebView } from 'react-native-webview';

export const useWebviewRef = ({
  ref,
  onNavigation,
}: {
  ref?: WebView;
  onNavigation: OnWebviewNavigation;
}) => {
  const goBack = useCallback(() => {
    try {
      ref?.goBack();
      // eslint-disable-next-line no-empty
    } catch {}
  }, [ref]);

  const goForward = useCallback(() => {
    try {
      ref?.goForward();
      // eslint-disable-next-line no-empty
    } catch {}
  }, [ref]);

  const reload = useCallback(() => {
    try {
      ref?.reload();
      // eslint-disable-next-line no-empty
    } catch {}
  }, [ref]);

  const stopLoading = useCallback(() => {
    try {
      ref?.stopLoading();
      onNavigation({ loading: false });
      // eslint-disable-next-line no-empty
    } catch {}
  }, [onNavigation, ref]);

  return {
    goBack,
    goForward,
    stopLoading,
    reload,
  };
};
