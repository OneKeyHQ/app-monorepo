import type { FC } from 'react';
import { useMemo } from 'react';

import WebView from '@onekeyhq/kit/src/components/WebView';

import { webTabsActions } from '../../../../store/observable/webTabs';
import { webviewRefs } from '../explorerUtils';

import type { WebTab } from '../../../../store/observable/webTabs';
import type { WebViewProps } from 'react-native-webview';

const WebContent: FC<WebTab & WebViewProps> = ({ id, url }) => {
  const webview = useMemo(
    () => (
      <WebView
        id={id}
        src={url}
        onWebViewRef={(ref) => {
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              webTabsActions.setWebTabData({ id, refReady: true });
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

  return webview;
};

WebContent.displayName = 'WebContent';

export default WebContent;
