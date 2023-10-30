import { openUrl } from '../../../utils/openUrl';
import { webTabsActions } from '../Explorer/Context/contextWebTabs';
import { crossWebviewLoadUrl, validateUrl, webHandler } from '../explorerUtils';

import { getWebTabs } from './useWebTabs';

import type { MatchDAppItemType } from '../explorerUtils';
import type { DAppItemType, WebSiteHistory } from '../types';

export const gotoSite = ({
  url,
  title,
  favicon,
  isNewWindow,
  isInPlace,
  id,
  userTriggered,
}: WebSiteHistory & {
  dAppId?: string;
  isNewWindow?: boolean;
  isInPlace?: boolean;
  id?: string;
  userTriggered?: boolean;
}) => {
  const { tab } = getWebTabs(id);
  if (url && tab) {
    const validatedUrl = validateUrl(url);
    if (!validatedUrl) {
      return;
    }

    if (userTriggered) {
      // TODO: add to history
    }

    // if (webHandler === 'browser') {
    //   return openUrl(validatedUrl);
    // }

    const tabId = tab.id;
    const isDeepLink =
      !validatedUrl.startsWith('http') && validatedUrl !== 'about:blank';
    const isNewTab =
      (isNewWindow || tabId === 'home' || isDeepLink) &&
      webHandler === 'tabbedWebview';

    // const urls = bookmarks?.map((item) => item.url);
    // const isBookmarked = urls?.includes(url);

    if (isNewTab) {
      webTabsActions.addWebTab({
        title,
        url: validatedUrl,
        favicon,
        isCurrent: true,
        isBookmarked: false,
      });
    } else {
      webTabsActions.setWebTabData({
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
    if (isDeepLink) {
      if (webHandler === 'tabbedWebview') {
        setTimeout(() => {
          webTabsActions.closeWebTab(tabId);
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
}: MatchDAppItemType) => {
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

export const onItemSelect = (dapp: DAppItemType) => {
  openMatchDApp({ id: dapp._id, dapp });
};
