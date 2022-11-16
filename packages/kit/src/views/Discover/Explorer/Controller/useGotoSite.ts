import { useCallback } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { appSelector } from '../../../../store';
import {
  addWebSiteHistory,
  setDappHistory,
  updateHistory,
} from '../../../../store/reducers/discover';
import {
  addWebTab,
  closeWebTab,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
import { openUrl } from '../../../../utils/openUrl';
import { WebSiteHistory } from '../../type';
import { crossWebviewLoadUrl, validateUrl, webHandler } from '../explorerUtils';

export const useGotoSite = ({ id }: { id?: string }) =>
  useCallback(
    ({
      url,
      title,
      favicon,
      dAppId,
      isNewWindow,
      isInPlace,
    }: WebSiteHistory & {
      dAppId?: string;
      isNewWindow?: boolean;
      isInPlace?: boolean;
    }) => {
      const {
        webTabs: { tabs },
        discover: { dappFavorites },
      } = appSelector((s) => s);
      const tab = tabs.find((t) => t.id === id);
      if (url && tab) {
        const validatedUrl = validateUrl(url);
        if (!validatedUrl) {
          return;
        }
        if (webHandler === 'browser') {
          return openUrl(validatedUrl);
        }
        const tabId = tab.id;
        const { dispatch } = backgroundApiProxy;
        const isDeepLink =
          !validatedUrl.startsWith('http') && validatedUrl !== 'about:blank';
        const isNewTab =
          (isNewWindow || tabId === 'home' || isDeepLink) &&
          webHandler === 'tabbedWebview';

        if (dAppId) {
          dispatch(setDappHistory(dAppId));
        }
        const isBookmarked = dappFavorites?.includes(url);

        dispatch(
          isNewTab
            ? addWebTab({
                title,
                url: validatedUrl,
                favicon,
                isCurrent: true,
                isBookmarked,
              })
            : setWebTabData({
                id: tabId,
                url: validatedUrl,
                title,
                favicon,
                isBookmarked,
              }),
          dAppId
            ? updateHistory(dAppId)
            : addWebSiteHistory({
                webSite: { url: validatedUrl, title, favicon },
              }),
        );

        if (!isNewTab && !isInPlace) {
          crossWebviewLoadUrl({
            url: validatedUrl,
            tabId,
          });
        }

        // close deep link tab after 1s
        if (isDeepLink) {
          if (webHandler === 'tabbedWebview') {
            setTimeout(() => {
              dispatch(closeWebTab(tabId));
            }, 1000);
          }
        }
        return true;
      }
      return false;
    },
    [id],
  );
