import { FC } from 'react';

import { Box } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';

import { WebTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home/DiscoverHome';

const WebContent: FC<WebTab> = ({ id, url }) => (
  <Box flex={1}>
    {id === 'home' ? (
      <DiscoverHome
        onItemSelect={(item) => gotoUrl({ id: item.id, dapp: item })}
        onItemSelectHistory={(item) => gotoUrl(item)}
      />
    ) : (
      <WebView
        src={url}
        // onWebViewRef={(ref) => {
        //   setWebviewRef(ref);
        // }}
        // onNavigationStateChange={setNavigationStateChangeEvent}
        allowpopups
      />
    )}
  </Box>
);

WebContent.displayName = 'WebContent';

export default WebContent;
