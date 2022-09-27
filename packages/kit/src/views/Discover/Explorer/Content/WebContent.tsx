import { FC, useMemo, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import WebView from '@onekeyhq/kit/src/components/WebView';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WebTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home/DiscoverHome';
import { useWebController } from '../Controller/useWebController';
import { webHandler, webviewRefs } from '../explorerUtils';

const WebContent: FC<WebTab> = ({ id, url }) => {
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();

  const [, setIsWebviewReady] = useState(false);
  const { gotoSite, openMatchDApp } = useWebController({
    id,
    navigationStateChangeEvent,
  });

  const showHome =
    (id === 'home' && webHandler === 'tabbedWebview') || url === '';
  const refreshCondition = platformEnv.isNative
    ? url
    : // electron is using loadURL() to load url
      // instead of url props changing
      // so only refresh when url changed from '' to non-empty
      // that is, from DiscoverHome to other pages
      url === '';
  return useMemo(
    () =>
      showHome ? (
        // TODO avoid rerender, maybe singleton
        <DiscoverHome
          onItemSelect={(dapp) =>
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            gotoSite({
              url: dapp.url,
              title: dapp.name,
              favicon: dapp.favicon,
              dAppId: dapp.id,
            })
          }
          // @ts-expect-error
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshCondition],
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
