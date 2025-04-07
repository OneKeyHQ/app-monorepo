import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';

import { BookmarksSectionItems } from './BookmarksSectionItems';
import { DashboardSectionHeader } from './DashboardSectionHeader';

import type { IBrowserBookmark, IMatchDAppItemType } from '../../types';

export function BookmarksSection() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const handleWebSite = useWebSiteHandler();

  const { result: bookmarksData, run: refreshLocalData } = usePromiseResult(
    async () => {
      const bookmarks =
        await backgroundApiProxy.serviceDiscovery.getBookmarkData({
          generateIcon: true,
          sliceCount: 14,
        });

      return bookmarks;
    },
    [],
    {
      watchLoading: true,
      checkIsMounted: false,
      checkIsFocused: false,
    },
  );

  // Listen for tab focus state to refresh data
  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    if (isFocus) {
      void refreshLocalData();
    }
  });

  // Set up listener for bookmark list refresh event
  useEffect(() => {
    const refreshBookmarkHandler = () => {
      void refreshLocalData();
    };

    appEventBus.on(
      EAppEventBusNames.RefreshBookmarkList,
      refreshBookmarkHandler,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.RefreshBookmarkList,
        refreshBookmarkHandler,
      );
    };
  }, [refreshLocalData]);

  const onPressMore = useCallback(() => {
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.BookmarkListModal,
    });
  }, [navigation]);

  const dataSource = useMemo<IBrowserBookmark[]>(
    () => bookmarksData ?? [],
    [bookmarksData],
  );
  const hasBookmarks = dataSource.length > 0;

  const handleOpenWebSite = useCallback(
    ({ dApp, webSite }: IMatchDAppItemType) => {
      handleWebSite({
        webSite,
        dApp,
        shouldPopNavigation: false,
        enterMethod: EEnterMethod.bookmark,
      });
    },
    [handleWebSite],
  );

  if (!hasBookmarks) {
    return null;
  }

  return (
    <Stack minHeight="$40">
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading selected>
          {intl.formatMessage({ id: ETranslations.explore_bookmarks })}
        </DashboardSectionHeader.Heading>

        {hasBookmarks ? (
          <DashboardSectionHeader.Button onPress={onPressMore}>
            {intl.formatMessage({ id: ETranslations.explore_see_all })}
          </DashboardSectionHeader.Button>
        ) : null}
      </DashboardSectionHeader>

      <BookmarksSectionItems
        dataSource={dataSource}
        handleOpenWebSite={handleOpenWebSite}
      />
    </Stack>
  );
}
