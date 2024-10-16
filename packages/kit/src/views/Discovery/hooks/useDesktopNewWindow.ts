import { useCallback, useEffect } from 'react';

import { useMedia } from '@onekeyhq/components';
import { ipcMessageKeys } from '@onekeyhq/desktop/src-electron/config';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import useAppNavigation from '../../../hooks/useAppNavigation';

export function useDesktopNewWindow() {
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;
  const { gtMd } = useMedia();
  const onNewWindow = useCallback(
    (_: any, data: { url: string }) => {
      if (data.url) {
        handleOpenWebSite({
          switchToMultiTabBrowser: gtMd,
          useCurrentWindow: false,
          webSite: {
            url: data.url,
            title: data.url,
          },
          navigation,
        });
      }
    },
    [gtMd, handleOpenWebSite, navigation],
  );
  useEffect(() => {
    globalThis.desktopApi?.addIpcEventListener(
      ipcMessageKeys.WEBVIEW_NEW_WINDOW,
      onNewWindow,
    );
    return () => {
      globalThis.desktopApi?.removeIpcEventListener(
        ipcMessageKeys.WEBVIEW_NEW_WINDOW,
        onNewWindow,
      );
    };
  }, [onNewWindow]);
}
