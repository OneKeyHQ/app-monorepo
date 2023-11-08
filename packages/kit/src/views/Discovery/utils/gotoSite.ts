import { openUrl } from '../../../utils/openUrl';
import {
  addWebTab,
  closeWebTab,
  setWebTabData,
} from '../container/Context/contextWebTabs';
import { getWebTabs } from '../hooks/useWebTabs';

import {
  browserTypeHandler,
  crossWebviewLoadUrl,
  validateUrl,
} from './explorerUtils';

import type {
  IDAppItemType,
  IMatchDAppItemType,
  IWebSiteHistory,
} from '../types';

export const gotoSite = ({
  url,
  title,
  favicon,
  isNewWindow,
  isInPlace,
  id,
  userTriggered,
}: IWebSiteHistory & {
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

    if (isNewTab) {
      addWebTab({
        title,
        url: validatedUrl,
        favicon,
        isBookmarked: false,
      });
    } else {
      setWebTabData({
        id: tabId,
        url: validatedUrl,
        title,
        favicon,
        isBookmarked: false,
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
          closeWebTab(tabId);
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
