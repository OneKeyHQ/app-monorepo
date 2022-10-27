import { useCallback } from 'react';

import { nanoid } from '@reduxjs/toolkit';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import {
  addWebSiteHistory,
  setDappHistory,
  updateHistory,
} from '../../../../store/reducers/discover';
import {
  WebTab,
  addWebTab,
  closeWebTab,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
import { openUrl } from '../../../../utils/openUrl';
import { WebSiteHistory } from '../../type';
import { crossWebviewLoadUrl, validateUrl, webHandler } from '../explorerUtils';

export const useGotoSite = ({ tab }: { tab?: WebTab }) => {
  const dappFavorites = useAppSelector((s) => s.discover.dappFavorites);
  return useCallback(
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
      if (url && tab) {
        const validatedUrl = validateUrl(url);
        if (!validatedUrl) {
          return;
        }
        if (webHandler === 'browser') {
          return openUrl(validatedUrl);
        }
        const { dispatch } = backgroundApiProxy;
        const isDeepLink =
          !validatedUrl.startsWith('http') && validatedUrl !== 'about:blank';
        const isNewTab =
          (isNewWindow || tab.id === 'home' || isDeepLink) &&
          webHandler === 'tabbedWebview';

        const tabId = isNewTab ? nanoid() : tab.id;
        if (dAppId) {
          dispatch(setDappHistory(dAppId));
        }
        const isBookmarked = dappFavorites?.includes(url);

        dispatch(
          isNewTab
            ? addWebTab({
                id: tabId,
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

        if (!isNewTab && !isInPlace && platformEnv.isDesktop) {
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
    [tab, dappFavorites],
  );
};
