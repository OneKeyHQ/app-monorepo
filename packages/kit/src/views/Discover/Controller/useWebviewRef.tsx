import { useCallback } from 'react';

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
      ref?.stop();
    } catch {
      /* empty */
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
