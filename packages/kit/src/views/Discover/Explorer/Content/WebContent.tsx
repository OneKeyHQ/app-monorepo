import React, { useCallback, useMemo, useRef, useState } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import { Freeze } from 'react-freeze';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { Box } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { WebTab, setWebTabData } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import { useGotoSite } from '../Controller/useGotoSite';
import { useWebController } from '../Controller/useWebController';
import { webHandler, webviewRefs } from '../explorerUtils';

const aboutBlankUrl = 'about:blank';

const WebContent = (tab: WebTab) => {
  const { id, url: initialUrl } = tab;
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();
  const [localUrl] = useState(aboutBlankUrl);

  const isInitUrlLoaded = useRef(false);
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

  const goToSite = useGotoSite({
    tab,
  });
  const loadInitialUrl = useCallback(() => {
    if (isInitUrlLoaded.current || !initialUrl || showHome) {
      return;
    }
    isInitUrlLoaded.current = true;
    setTimeout(() => {
      goToSite({
        url: initialUrl,
      });
    }, 600); // add some delay wait for webview dom-ready
  }, [initialUrl, showHome, goToSite]);

  const onWebViewRef = useCallback(
    (ref: IWebViewWrapperRef | null) => {
      const { dispatch } = backgroundApiProxy;
      if (ref && ref.innerRef) {
        if (webviewRefs[id] === ref) {
          // return;
        }
        webviewRefs[id] = ref;
        // TODO check if equal before dispatch
        dispatch(setWebTabData({ id, refReady: true }));
        loadInitialUrl();
      } else {
        if (!webviewRefs[id]) {
          // return;
        }
        delete webviewRefs[id];
        // TODO check if equal before dispatch
        dispatch(setWebTabData({ id, refReady: false }));
      }
    },
    [loadInitialUrl, id],
  );

  const { openMatchDApp } = useWebController({
    id,
    navigationStateChangeEvent,
  });

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
        {/* TODO show DiscoverHome in Webview if about:blank */}
        {/* TODO do not unmount desktop webview when showHome */}
        <WebView
          // key={webviewKey} // set different key will break browser history
          src={localUrl}
          onWebViewRef={onWebViewRef}
          onNavigationStateChange={setNavigationStateChangeEvent}
          allowpopups
        />
      </Freeze>
    </>
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
