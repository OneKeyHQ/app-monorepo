import { useCallback, useEffect, useRef, useState } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

import { Box } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { WebTab, setWebTabData } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import { useGotoSite } from '../Controller/useGotoSite';
import { useWebController } from '../Controller/useWebController';
import { webviewRefs } from '../explorerUtils';

/*
Desktop should load 'about:blank' first to avoid DAPP site load before webview message bridge established.

Because Desktop webview message bridge is initialized after webview mounted with ref ready and ipc-message ready
 */
// const aboutBlankUrl = '';
const aboutBlankUrl = 'about:blank';

const WebContent = (tab: WebTab) => {
  const { id, url: reduxUrl } = tab;
  const [localUrl] = useState(aboutBlankUrl);

  const isInitUrlLoaded = useRef(false);
  const [showHome, setShowHome] = useState(false);

  useEffect(() => {
    if (isInitUrlLoaded.current) {
      setShowHome(reduxUrl === aboutBlankUrl);
    }
  }, [reduxUrl]);

  const goToSite = useGotoSite({
    tab,
  });
  const loadInitialUrl = useCallback(() => {
    if (isInitUrlLoaded.current) {
      return;
    }
    isInitUrlLoaded.current = true;
    if (reduxUrl !== aboutBlankUrl) {
      setTimeout(() => {
        goToSite({ url: reduxUrl });
      }, 500); // add some delay wait for webview dom-ready
    } else {
      setShowHome(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onWebViewRef = useCallback(
    (ref: IWebViewWrapperRef | null) => {
      const { dispatch } = backgroundApiProxy;
      if (ref && ref.innerRef) {
        if (!webviewRefs[id]) {
          dispatch(setWebTabData({ id, refReady: true }));
        }
        webviewRefs[id] = ref;
        loadInitialUrl();
      }
    },
    [loadInitialUrl, id],
  );

  const { openMatchDApp } = useWebController({
    id,
  });

  return (
    <>
      <WebView src={localUrl} onWebViewRef={onWebViewRef} allowpopups />
      {showHome && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            zIndex: 1,
          }}
        >
          <DiscoverHome
            onItemSelect={(dapp) => {
              openMatchDApp({ id: dapp._id, dapp });
            }}
            onItemSelectHistory={openMatchDApp}
          />
        </Box>
      )}
    </>
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
