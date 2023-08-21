import { useEffect, useMemo, useState } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { DAppItemType } from '../type';

export function useUserBrowserHistories(): MatchDAppItemType[] {
  const userBrowserHistories = useAppSelector(
    (s) => s.discover.userBrowserHistories,
  );
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
  const bookmarks = useAppSelector((s) => s.discover.bookmarks);
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
