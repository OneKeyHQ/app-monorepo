import { FC, useMemo } from 'react';

import { View } from 'react-native';

import WebView from '@onekeyhq/kit/src/components/WebView';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  WebTab,
  homeTab,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import { useWebController } from '../Controller/useWebController';
import { webHandler, webviewRefs } from '../explorerUtils';

const WebContent: FC<WebTab> = ({ id, url }) => {
  const { openMatchDApp } = useWebController({
    id,
  });

  const showHome =
    (id === 'home' && webHandler === 'tabbedWebview') || url === homeTab.url;

  const webview = useMemo(
    () => (
      <WebView
        id={id}
        src={url}
        onWebViewRef={(ref) => {
          const { dispatch } = backgroundApiProxy;
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              dispatch(setWebTabData({ id, refReady: true }));
            }
            webviewRefs[id] = ref;
          }
        }}
        allowpopups
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  return (
    <>
      {webview}
      {showHome && (
        <View
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
        </View>
      )}
    </>
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
