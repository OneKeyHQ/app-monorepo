import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import { Freeze } from 'react-freeze';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { Box } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { WebTab, setWebTabData } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import { useGotoSite } from '../Controller/useGotoSite';
import { useWebController } from '../Controller/useWebController';
import { webHandler, webviewKeys, webviewRefs } from '../explorerUtils';

// const aboutBlankUrl = '';
const aboutBlankUrl = 'about:blank';

const WebContent = React.memo((tab: WebTab) => {
  const { id } = tab;
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();
  const shouldAutoReload = useRef(platformEnv.isDesktop);
  const [localUrl, setLocalUrl] = useState(
    aboutBlankUrl,
    // platformEnv.isDesktop ? 'about:blank' : url,
  );
  const localUrlRef = useRef(localUrl);
  localUrlRef.current = localUrl;

  const goToSite = useGotoSite({
    tab,
  });
  const initialUrl = tab.url;
  const isInitUrlLoaded = useRef(false);
  const loadInitialUrl = useCallback(() => {
    if (isInitUrlLoaded.current || !initialUrl) {
      return;
    }
    isInitUrlLoaded.current = true;
    setTimeout(() => {
      goToSite({
        url: initialUrl,
      });
    }, 600); // add some delay wait for dom-ready
  }, [initialUrl, goToSite]);

  const onSrcChange = useCallback((src: string) => {
    if (platformEnv.isDesktop) {
      shouldAutoReload.current = true;
    }
    // native: wrapperRef?.loadURL()  -> onSrcChange -> setLocalUrl -> webview.src
    if (platformEnv.isNative) {
      setLocalUrl(src);
    }
  }, []);
  const wrapperRef = useRef<IWebViewWrapperRef | null>(null);
  const onWebViewRef = useCallback(
    (ref: IWebViewWrapperRef | null) => {
      const { dispatch } = backgroundApiProxy;
      wrapperRef.current = ref;
      if (ref && ref.innerRef) {
        if (webviewRefs[id] === ref) {
          return;
        }
        webviewRefs[id] = ref;
        dispatch(setWebTabData({ id, refReady: true }));
        loadInitialUrl();
        if (shouldAutoReload.current) {
          shouldAutoReload.current = false;
          // *** should reload(url) after webviewRef update
          setTimeout(() => {
            // TODO may cause browser infinite refresh and history incorrect
            // TODO onWebViewRef called many times
            // ref.reload();
          }, 300); // wait src changed done and reload()
        }
      } else {
        if (!webviewRefs[id]) {
          return;
        }
        delete webviewRefs[id];
        dispatch(setWebTabData({ id, refReady: false }));
      }
    },
    [loadInitialUrl, id],
  );

  const { openMatchDApp } = useWebController({
    id,
    navigationStateChangeEvent,
  });

  const showHome = useMemo(() => {
    if (id === 'home' && webHandler === 'tabbedWebview') {
      return true;
    }
    if (localUrl === aboutBlankUrl || !localUrl) {
      if (!initialUrl && !isInitUrlLoaded.current) {
        return true;
      }
    }
    return false;
  }, [id, initialUrl, localUrl]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const webviewKey = webviewKeys[id];

  return (
    <>
      <Freeze freeze={!showHome}>
        <DiscoverHome
          onItemSelect={(dapp) => {
            openMatchDApp({ id: dapp._id, dapp });
          }}
          onItemSelectHistory={openMatchDApp}
        />
      </Freeze>
      <Freeze freeze={showHome}>
        <Box testID={`webview: ${localUrl} - ${initialUrl}`} />
        <WebView
          // TODO update key will break browser history
          // key={webviewKey}
          src={localUrl}
          // wrapperRef?.loadURL() will trigger onSrcChange
          onSrcChange={onSrcChange}
          onWebViewRef={onWebViewRef}
          onNavigationStateChange={setNavigationStateChangeEvent}
          allowpopups
        />
      </Freeze>
    </>
  );
});

WebContent.displayName = 'WebContent';

export default WebContent;
