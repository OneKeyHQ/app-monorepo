import type { FC } from 'react';
import { useCallback, useMemo, useRef } from 'react';

import { openURL as LinkingOpenUrl } from 'expo-linking';
// import { captureRef } from 'react-native-view-shot';

import WebView from '@onekeyhq/kit/src/components/WebView';
import urlUtils from '@onekeyhq/shared/src/utils/urlUtils';

import { WALLET_CONNECT_PROTOCOL_PREFIXES } from '../../../../components/WalletConnect/walletConnectConsts';
import useBackHandler from '../../../../hooks/useBackHandler';
import { handleDeepLinkUrl } from '../../../../routes/deepLink';
import { homeTab, webTabsActions } from '../../../../store/observable/webTabs';
import { gotoSite } from '../Controller/gotoSite';
import { onNavigation } from '../Controller/useWebController';
import { MAX_OR_SHOW, expandAnim } from '../explorerAnimation';
import { webviewRefs } from '../explorerUtils';

import type { WebTab } from '../../../../store/observable/webTabs';
import type { WebViewNavigation, WebViewProps } from 'react-native-webview';

const WebContent: FC<WebTab & WebViewProps> = ({
  id,
  url,
  isCurrent,
  androidLayerType,
  canGoBack,
}) => {
  const lastNavEventSnapshot = useRef('');
  const showHome = url === homeTab.url;

  const onNavigationStateChange = useCallback(
    (navigationStateChangeEvent: WebViewNavigation) => {
      if (showHome) {
        return;
      }
      const snapshot = JSON.stringify(navigationStateChangeEvent);
      if (snapshot === lastNavEventSnapshot.current) {
        return;
      }
      lastNavEventSnapshot.current = snapshot;
      const {
        // eslint-disable-next-line @typescript-eslint/no-shadow
        canGoBack,
        canGoForward,
        loading,
        title,
        url: navUrl,
      } = navigationStateChangeEvent;
      if (loading) {
        onNavigation({
          url: navUrl,
          title,
          canGoBack,
          canGoForward,
          loading,
          id,
        });
      } else {
        onNavigation({ title, canGoBack, canGoForward, loading, id });
      }
    },
    [id, showHome],
  );
  const onShouldStartLoadWithRequest = useCallback(
    (navigationStateChangeEvent: WebViewNavigation) => {
      const { url: navUrl } = navigationStateChangeEvent;
      const maybeDeepLink =
        !navUrl.startsWith('http') && navUrl !== 'about:blank';
      if (maybeDeepLink) {
        const { action } = urlUtils.parseDappRedirect(navUrl);
        if (action === urlUtils.DAppOpenActionEnum.DENY) {
          return false;
        }
        if (
          WALLET_CONNECT_PROTOCOL_PREFIXES.some((prefix) =>
            navUrl.startsWith(prefix),
          )
        ) {
          handleDeepLinkUrl({ url: navUrl });
        }
        return false;
      }
      return true;
    },
    [],
  );

  useBackHandler(
    useCallback(() => {
      if (
        isCurrent &&
        expandAnim.value === MAX_OR_SHOW &&
        webviewRefs[id] &&
        canGoBack &&
        id !== homeTab.id
      ) {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        webviewRefs[id]?.innerRef?.goBack();
        return true;
      }
      return false;
    }, [canGoBack, id, isCurrent]),
  );

  const webview = useMemo(
    () => (
      <WebView
        key={String(showHome)}
        androidLayerType={androidLayerType}
        src={url}
        onWebViewRef={(ref) => {
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              webTabsActions.setWebTabData({ id, refReady: true });
            }
            if (id !== homeTab.id) {
              webviewRefs[id] = ref;
            }
          }
        }}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        onOpenWindow={(e) => {
          gotoSite({ url: e.nativeEvent.targetUrl, userTriggered: true });
        }}
        allowpopups
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, showHome, androidLayerType, onNavigationStateChange],
  );

  return webview;
};

WebContent.displayName = 'WebContent';

export default WebContent;
