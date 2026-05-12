import { useCallback, useEffect } from 'react';

import { useMedia } from '@onekeyhq/components';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { EDesktopIpcChannel } from '@onekeyhq/shared/src/consts/desktopIpcChannels';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { handleDeepLinkUrl } from '../../../routes/config/deeplink';
import { isOverlayWebContentsId } from '../../WebView/utils/overlayContentsRegistry';

export function useDesktopNewWindow() {
  const navigation = useAppNavigation();
  const { handleOpenWebSite, validateWebviewSrc } = useBrowserAction().current;
  const { gtMd } = useMedia();
  const onNewWindow = useCallback(
    (data: { url: string; sourceWebContentsId?: number }) => {
      if (!data.url) return;
      // Skip popups that originated from the WebView overlay route — those
      // are handled by the overlay's own listener with the stricter
      // isAllowedWebViewUrl policy. Without this guard, an overlay page
      // could `window.open('http://localhost/...')` and have Discovery
      // happily open the URL in a new tab.
      if (isOverlayWebContentsId(data.sourceWebContentsId)) return;
      // Mirror Discovery's WebContent navigation policy (validateWebviewSrc):
      // - Valid          → open in Discovery tab (handleOpenWebSite)
      // - ValidDeeplink  → route through deeplink handler (onekey-wallet://…)
      // - other          → silently drop (phishing / unsupported / punycode)
      const validateState = validateWebviewSrc({
        url: data.url,
        isTopFrame: true,
      });
      if (validateState === EValidateUrlEnum.ValidDeeplink) {
        handleDeepLinkUrl({ url: data.url });
        return;
      }
      if (validateState !== EValidateUrlEnum.Valid) {
        return;
      }
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
    },
    [handleOpenWebSite, validateWebviewSrc, navigation, gtMd],
  );
  useEffect(() => {
    const unsubscribe = globalThis.desktopApi?.addIpcEventListener(
      EDesktopIpcChannel.WEBVIEW_NEW_WINDOW,
      onNewWindow,
    );
    return () => {
      unsubscribe?.();
    };
  }, [onNewWindow]);
}
