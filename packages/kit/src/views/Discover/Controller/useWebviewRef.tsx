import { useCallback } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useWebTabsActions } from '../Explorer/Context/contextWebTabs';

import type { IElectronWebView } from '../../../components/WebView/types';
import type { OnWebviewNavigation } from '../explorerUtils';
import type WebView from 'react-native-webview';

export const useWebviewRef = ({
  ref,
  tabId,
  onNavigation,
}: {
  ref?: IElectronWebView;
  onNavigation: OnWebviewNavigation;
  tabId: string;
}) => {
  const actions = useWebTabsActions();
  const goBack = useCallback(() => {
    try {
      ref?.goBack();
    } catch {
      /* empty */
    }
  }, [ref]);

  const goForward = useCallback(() => {
    try {
      ref?.goForward();
    } catch {
      /* empty */
    }
  }, [ref]);

  const stopLoading = useCallback(() => {
    try {
      if (platformEnv.isNative) {
        (ref as unknown as WebView)?.stopLoading();
        onNavigation({ loading: false });
      } else {
        ref?.stop();
      }
    } catch {
      /* empty */
    }
  }, [ref, onNavigation]);

  const reload = useCallback(() => {
    try {
      if (platformEnv.isNative) {
        ref?.reload();
      } else {
        const wrapperRef = actions.getWebviewWrapperRef(tabId);
        // cross-platform reload()
        wrapperRef?.reload();
      }
    } catch {
      /* empty */
    }
  }, [ref, actions, tabId]);

  const loadURL = useCallback(
    (url: string) => {
      actions.crossWebviewLoadUrl({
        url,
        tabId,
      });
    },
    [actions, tabId],
  );

  return {
    goBack,
    goForward,
    stopLoading,
    loadURL,
    reload,
  };
};
