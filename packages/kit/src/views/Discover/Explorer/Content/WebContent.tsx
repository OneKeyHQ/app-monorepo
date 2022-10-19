import React, { useCallback, useRef, useState } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import { Freeze } from 'react-freeze';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import WebView from '@onekeyhq/kit/src/components/WebView';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useEffectOnUpdate } from '../../../../hooks/useEffectOnUpdate';
import { WebTab, setWebTabData } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import { useWebController } from '../Controller/useWebController';
import { webHandler, webviewKeys, webviewRefs } from '../explorerUtils';

const WebContent = React.memo(({ id, url }: WebTab) => {
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();
  const shouldAutoReload = useRef(platformEnv.isDesktop);
  const [localUrl, setLocalUrl] = useState(
    url,
    // platformEnv.isDesktop ? 'about:blank' : url,
  );
  const localUrlRef = useRef(localUrl);
  localUrlRef.current = localUrl;

  useEffectOnUpdate(() => {
    // TODO cause browser history strange
    if (localUrlRef.current !== url) {
      setTimeout(() => setLocalUrl(url), 0);
    }
  }, [url, localUrlRef.current]);
  const onSrcChange = useCallback((src: string) => {
    if (platformEnv.isDesktop) {
      shouldAutoReload.current = true;
    }
    setLocalUrl(src);
  }, []);
  const onWebViewRef = useCallback(
    (ref: IWebViewWrapperRef | null) => {
      const { dispatch } = backgroundApiProxy;
      if (ref && ref.innerRef) {
        if (webviewRefs[id] === ref) {
          return;
        }
        webviewRefs[id] = ref;
        dispatch(setWebTabData({ id, refReady: true }));
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
    [id],
  );

  const { openMatchDApp } = useWebController({
    id,
    navigationStateChangeEvent,
  });

  const showHome =
    (id === 'home' && webHandler === 'tabbedWebview') || url === '';

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
        <WebView
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
