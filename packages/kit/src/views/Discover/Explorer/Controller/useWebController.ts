import { createRef, useContext } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { addWebSiteHistory } from '../../../../store/reducers/discover';
import { setWebTabData } from '../../../../store/reducers/webTabs';

import { useWebviewRef } from './useWebviewRef';
import { WebviewRefsContext } from './WebviewRefsContext';

export const useWebController = ({ id }: { id: string }) => {
  const webviewRefs = useContext(WebviewRefsContext);
  const { dispatch } = backgroundApiProxy;
  const {
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    stopLoading,
    loading: webLoading,
    url: webUrl,
    title: webTitle,
    favicon: webFavicon,
  } = useWebviewRef(
    webviewRefs[id],
    navigationStateChangeEvent,
    (url: string) => {
      dispatch(
        setWebTabData({ id, url }),
        addWebSiteHistory({
          keyUrl: undefined,
          webSite: { url },
        }),
      );
    },
  );
};
