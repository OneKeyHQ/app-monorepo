import { useCallback, useRef } from 'react';

import { crossWebviewLoadUrl, getWebviewWrapperRef } from '../explorerUtils';

import type { IElectronWebView } from '../../../components/WebView/types';
import type { OnWebviewNavigation } from '../explorerUtils';

export const useWebviewRef = ({
  ref,
  tabId,
}: {
  ref?: IElectronWebView;
  onNavigation: OnWebviewNavigation;
  tabId: string;
}) => {
  const isDomReady = useRef(false);

  const goBack = useCallback(() => {
    if (isDomReady.current) {
      ref?.goBack();
    }
  }, [ref]);

  const goForward = useCallback(() => {
    if (isDomReady.current) {
      ref?.goForward();
    }
  }, [ref]);

  const stopLoading = useCallback(() => {
    if (isDomReady.current) {
      ref?.stop();
    }
  }, [ref]);

  const reload = useCallback(() => {
    const wrapperRef = getWebviewWrapperRef(tabId);
    // cross-platform reload()
    wrapperRef?.reload();
  }, [tabId]);

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
