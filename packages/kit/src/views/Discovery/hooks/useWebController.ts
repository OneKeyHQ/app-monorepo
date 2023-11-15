import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import {
  homeResettingFlags,
  homeTab,
  setWebTabData,
} from '../store/contextWebTabs';
import { gotoSite } from '../utils/gotoSite';

import { getWebTabs } from './useWebTabs';

import type { IOnWebviewNavigation } from '../types';

export const onNavigation: IOnWebviewNavigation = ({
  url,
  isNewWindow,
  isInPlace,
  title,
  favicon,
  canGoBack,
  canGoForward,
  loading,
  id,
  handlePhishingUrl,
}) => {
  const now = Date.now();
  const { tab: curTab } = getWebTabs(id);
  if (!curTab) {
    return;
  }
  const curId = curTab.id;
  const isValidNewUrl = typeof url === 'string' && url !== curTab.url;
  if (isValidNewUrl) {
    if (curTab.timestamp && now - curTab.timestamp < 500) {
      // ignore url change if it's too fast to avoid back & forth loop
      return;
    }
    if (
      homeResettingFlags[curId] &&
      url !== homeTab.url &&
      now - homeResettingFlags[curId] < 1000
    ) {
      return;
    }

    const { action } = uriUtils.parseDappRedirect(url);
    if (action === uriUtils.EDAppOpenActionEnum.DENY) {
      handlePhishingUrl?.(url);
      return;
    }

    gotoSite({ url, title, favicon, isNewWindow, isInPlace, id: curId });
  }

  void setWebTabData({
    id: curId,
    title,
    favicon,
    canGoBack,
    canGoForward,
    loading,
  });
};
