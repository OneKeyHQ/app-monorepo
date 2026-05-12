import { useCallback, useEffect } from 'react';

import { useMedia } from '@onekeyhq/components';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { handleDeepLinkUrl } from '../../../routes/config/deeplink';

export function useDesktopNewWindow() {
  const navigation = useAppNavigation();
  const { handleOpenWebSite, validateWebviewSrc } = useBrowserAction().current;
  const { gtMd } = useMedia();
  const onNewWindow = useCallback(
    (data: { url: string }) => {
      if (!data.url) return;
      // Mirror Discovery's WebContent navigation policy (validateWebviewSrc):
      // - Valid          → open in Discovery tab (handleOpenWebSite)
      // - ValidDeeplink  → route through deeplink handler (onekey-wallet://…)
      // - other          → silently drop (phishing / unsupported / punycode)
      // Overlay-route popups need their own desktop popup/IPC handler with the
      // stricter isAllowedWebViewUrl policy — not enforced here so Discovery
      // can still open http://, dev-only localhost, and deeplink targets.
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
      ipcMessageKeys.WEBVIEW_NEW_WINDOW,
      onNewWindow,
    );
    return () => {
      unsubscribe?.();
    };
  }, [onNewWindow]);
}
