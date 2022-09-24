import { FC, useContext } from 'react';

import WebView from '@onekeyhq/kit/src/components/WebView';

import { WebTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home/DiscoverHome';
import { useWebController } from '../Controller/useWebController';
import { webviewRefs } from '../Controller/webviewRefs';

const WebContent: FC<WebTab> = ({ id, url }) => {
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();
  const { gotoUrl } = useWebController({
    webviewRef: webviewRefs[id],
    navigationStateChangeEvent,
  });
  return id === 'home' || url === '' ? (
    <DiscoverHome
      onItemSelect={(item) => gotoUrl({ id: item.id, dapp: item })}
      onItemSelectHistory={(item) => gotoUrl(item)}
    />
  ) : (
    <WebView
      src={url}
      onWebViewRef={(ref) => {
        if (ref) {
          webviewRefs[id] = ref;
        }
      }}
      onNavigationStateChange={setNavigationStateChangeEvent}
      allowpopups
    />
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
