import { useCallback, useEffect } from 'react';

import { useMedia } from '@onekeyhq/components';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import useAppNavigation from '../../../hooks/useAppNavigation';

export function useDesktopNewWindow() {
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;
  const { gtMd } = useMedia();
  const onNewWindow = useCallback(
    (data: { url: string }) => {
      if (data.url) {
        handleOpenWebSite({
          useCurrentWindow: false,
          webSite: {
            url: data.url,
            title: data.url,
            logo: undefined,
            sortIndex: undefined,
          },
          gtMd,
          navigation,
        });
      }
    },
    [handleOpenWebSite, navigation, gtMd],
  );
  useEffect(() => {
    const unsubscribe = globalThis.desktopApi?.addIpcEventListener(
      ipcMessageKeys.WEBVIEW_NEW_WINDOW,
      onNewWindow,
    );
    return () => {
      unsubscribe?.();
    };
  }, [onNewWindow]);
}
