import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { appSelector } from '../../../../store';
import { webTabsActions } from '../../../../store/observable/webTabs';
import { addUserBrowserHistory } from '../../../../store/reducers/discover';
import { openUrl } from '../../../../utils/openUrl';
import { crossWebviewLoadUrl, validateUrl, webHandler } from '../explorerUtils';

import { getWebTabs } from './useWebTabs';

import type { DAppItemType, WebSiteHistory } from '../../type';
import type { MatchDAppItemType } from '../explorerUtils';

export const gotoSite = ({
  url,
  title,
  favicon,
  dAppId,
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
  const {
    discover: { bookmarks },
  } = appSelector((s) => s);
  const { tabs, currentTabId } = getWebTabs();
  const curId = id || currentTabId;
  const tab = tabs.find((t) => t.id === curId);
  const { dispatch } = backgroundApiProxy;
  if (url && tab) {
    const validatedUrl = validateUrl(url);
    if (!validatedUrl) {
      return;
    }

    if (userTriggered) {
      dispatch(
        addUserBrowserHistory({
          url: validatedUrl,
          dappId: dAppId,
          title,
          timestamp: Date.now(),
        }),
      );
      backgroundApiProxy.serviceDiscover.fillInUserBrowserHistory({
        dappId: dAppId,
        url: validatedUrl,
      });
    }

    if (webHandler === 'browser') {
      return openUrl(validatedUrl);
    }

    const tabId = tab.id;
    const isDeepLink =
      !validatedUrl.startsWith('http') && validatedUrl !== 'about:blank';
    const isNewTab =
      (isNewWindow || tabId === 'home' || isDeepLink) &&
      webHandler === 'tabbedWebview';

    const urls = bookmarks?.map((item) => item.url);
    const isBookmarked = urls?.includes(url);

    if (isNewTab) {
      webTabsActions.addWebTab({
        title,
        url: validatedUrl,
        favicon,
        isCurrent: true,
        isBookmarked,
      });
    } else {
      webTabsActions.setWebTabData({
        id: tabId,
        url: validatedUrl,
        title,
        favicon,
        isBookmarked,
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
