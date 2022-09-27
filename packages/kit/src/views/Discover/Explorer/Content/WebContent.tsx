import { FC, useMemo, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import WebView from '@onekeyhq/kit/src/components/WebView';

import { WebTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home/DiscoverHome';
import { useWebController } from '../Controller/useWebController';
import { webviewRefs } from '../explorerUtils';

const WebContent: FC<WebTab> = ({ id, url }) => {
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();

  const [, setIsWebviewReady] = useState(false);
  const { gotoSite, openMatchDApp } = useWebController({
    id,
    navigationStateChangeEvent,
  });

  return useMemo(
    () =>
      id === 'home' || url === '' ? (
        // TODO avoid rerender, maybe singleton
        <DiscoverHome
          onItemSelect={(dapp) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            gotoSite({
              url: dapp.url,
              title: dapp.name,
              favicon: dapp.favicon,
              dAppId: dapp.id,
            });
          }}
          onItemSelectHistory={openMatchDApp}
        />
      ) : (
        <WebView
          src={url}
          onWebViewRef={(ref) => {
            if (ref && ref.innerRef) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              webviewRefs[id] = ref;
              // force update webcontroller
              setIsWebviewReady(true);
            } else {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              delete webviewRefs[id];
            }
          }}
          onNavigationStateChange={setNavigationStateChangeEvent}
          allowpopups
        />
      ),
    // only refresh when url is empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url === ''],
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
