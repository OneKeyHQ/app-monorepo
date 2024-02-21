import { useCallback, useEffect } from 'react';

import { ipcMessageKeys } from '@onekeyhq/desktop/src-electron/config';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import useAppNavigation from '../../../hooks/useAppNavigation';

export function useDesktopNewWindow() {
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;
  const onNewWindow = useCallback(
    (_: any, data: { url: string }) => {
      if (data.url) {
        handleOpenWebSite({
          useCurrentWindow: false,
          webSite: {
            url: data.url,
            title: data.url,
          },
          navigation,
        });
      }
    },
    [handleOpenWebSite, navigation],
  );
  useEffect(() => {
    window.desktopApi?.addIpcEventListener(
      ipcMessageKeys.WEBVIEW_NEW_WINDOW,
      onNewWindow,
    );
    return () => {
      window.desktopApi?.removeIpcEventListener(
        ipcMessageKeys.WEBVIEW_NEW_WINDOW,
        onNewWindow,
      );
    };
  }, [onNewWindow]);
}
