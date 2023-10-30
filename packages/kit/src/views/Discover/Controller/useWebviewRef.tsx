import { useCallback } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { crossWebviewLoadUrl, getWebviewWrapperRef } from '../explorerUtils';

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
        const wrapperRef = getWebviewWrapperRef(tabId);
        // cross-platform reload()
        wrapperRef?.reload();
      }
    } catch {
      /* empty */
    }
  }, [tabId, ref]);

  const loadURL = useCallback(
    (url: string) => {
      crossWebviewLoadUrl({
        url,
        tabId,
      });
    },
    [tabId],
  );

  return {
    goBack,
    goForward,
    stopLoading,
    loadURL,
    reload,
  };
};
