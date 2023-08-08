import { useEffect, useMemo, useState } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  selectDevMode,
  selectDiscoverBookmarks,
  selectShowBookmark,
  selectUserBrowserHistories,
} from '../../../store/selectors';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { DAppItemType } from '../type';

export function useUserBrowserHistories(): MatchDAppItemType[] {
  const userBrowserHistories = useAppSelector(selectUserBrowserHistories);
  return useMemo(() => {
    if (!userBrowserHistories) {
      return [];
    }
    return userBrowserHistories.map((item) => ({
      id: item.url,
      webSite: {
        url: item.url,
        title: item.title,
        favicon: item.logoUrl,
      },
      timestamp: item.timestamp,
    }));
  }, [userBrowserHistories]);
}

export function useDiscoverFavorites(): MatchDAppItemType[] {
  const bookmarks = useAppSelector(selectDiscoverBookmarks);
  return useMemo(() => {
    if (!bookmarks) {
      return [];
    }
    return bookmarks.map((bookmark) => ({
      id: bookmark.url,
      webSite: {
        title: bookmark.title,
        favicon: bookmark.icon,
        url: bookmark.url,
      },
    }));
  }, [bookmarks]);
}

export function useCategoryDapps(categoryId?: string): DAppItemType[] {
  const [categoryDapps, setCategoryDapps] = useState<DAppItemType[]>([]);
  useEffect(() => {
    if (categoryId) {
      backgroundApiProxy.serviceDiscover
        .getCategoryDapps(categoryId)
        .then(setCategoryDapps);
    }
  }, [categoryId]);
  return categoryDapps;
}

export function useTagDapps(tagId: string) {
  const [tagDapps, setTagDapps] = useState<DAppItemType[]>([]);
  useEffect(() => {
    if (tagId) {
      backgroundApiProxy.serviceDiscover.getTagDapps(tagId).then(setTagDapps);
    }
  }, [tagId]);
  return tagDapps;
}

export function useShowBookmark() {
  const isApple = platformEnv.isNativeIOS || platformEnv.isMas;
  const showBookmark = useAppSelector(selectShowBookmark);
  const hideDiscoverContent =
    useAppSelector(selectDevMode)?.hideDiscoverContent;
  return useMemo(() => {
    if (hideDiscoverContent) {
      return false;
    }
    if (!isApple) {
      return true;
    }
    return showBookmark;
  }, [showBookmark, isApple, hideDiscoverContent]);
}
