import { openUrl } from '../../../utils/openUrl';
import { getWebTabs } from '../hooks/useWebTabs';
import { getBrowserBookmarks } from '../store/contextBrowserBookmark';
import { addWebTab, closeWebTab, setWebTabData } from '../store/contextWebTabs';

import {
  browserTypeHandler,
  crossWebviewLoadUrl,
  validateUrl,
} from './explorerUtils';

import type { IDAppItemType, IMatchDAppItemType } from '../types';

export const gotoSite = ({
  url,
  title,
  favicon,
  isNewWindow,
  isInPlace,
  id,
  userTriggered,
}: {
  url: string;
  title?: string;
  favicon?: string;
  dAppId?: string;
  isNewWindow?: boolean;
  isInPlace?: boolean;
  id?: string;
  userTriggered?: boolean;
}) => {
  const { tab } = getWebTabs(id);
  if (url) {
    const validatedUrl = validateUrl(url);
    if (!validatedUrl) {
      return;
    }

    if (userTriggered) {
      // TODO: add to history
    }

    if (browserTypeHandler === 'StandardBrowser') {
      return openUrl(validatedUrl);
    }

    const tabId = tab?.id;
    const maybeDeepLink =
      !validatedUrl.startsWith('http') && validatedUrl !== 'about:blank';

    const isNewTab =
      (isNewWindow || !tabId || tabId === 'home' || maybeDeepLink) &&
      browserTypeHandler === 'MultiTabBrowser';

    const bookmarks = getBrowserBookmarks();
    const isBookmark = bookmarks?.some((item) =>
      item.url.includes(validatedUrl),
    );

    if (isNewTab) {
      addWebTab({
        title,
        url: validatedUrl,
        favicon,
        isBookmark,
      });
    } else {
      void setWebTabData({
        id: tabId,
        url: validatedUrl,
        title,
        favicon,
        isBookmark,
      });
    }

    if (!isNewTab && !isInPlace) {
      crossWebviewLoadUrl({
        url: validatedUrl,
        tabId,
      });
    }

    // close deep link tab after 1s
    if (maybeDeepLink) {
      if (browserTypeHandler === 'MultiTabBrowser' && tabId) {
        setTimeout(() => {
          void closeWebTab(tabId);
        }, 1000);
      }
    }
    return true;
  }

  return false;
};

export const openMatchDApp = ({
  dapp,
  webSite,
  isNewWindow,
}: IMatchDAppItemType) => {
  if (webSite) {
    return gotoSite({
      url: webSite.url,
      title: webSite.title,
      // TODO: get favicon from url
      // @ts-expect-error
      favicon: webSite.favicon,
      isNewWindow,
      userTriggered: true,
    });
  }
  if (dapp) {
    return gotoSite({
      url: dapp.url,
      title: dapp.name,
      dAppId: dapp._id,
      favicon: dapp.logoURL,
      userTriggered: true,
      isNewWindow,
    });
  }
};

export const onItemSelect = (dapp: IDAppItemType, isNewWindow?: boolean) => {
  openMatchDApp({ id: dapp._id, dapp, isNewWindow });
};
