import { useCallback, useEffect, useMemo } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { SizableText, Skeleton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { BookmarksSectionItems } from './BookmarksSectionItems';
import { DashboardSectionHeader } from './DashboardSectionHeader';

import type { IBrowserBookmark, IMatchDAppItemType } from '../../types';

export function BookmarksSection({
  handleOpenWebSite,
}: {
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

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

  const isLoadingBookmarks = isNil(bookmarksData);
  const hasBookmarks = dataSource.length > 0;

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

      {hasBookmarks ? (
        <BookmarksSectionItems
          dataSource={dataSource}
          handleOpenWebSite={handleOpenWebSite}
        />
      ) : (
        <Stack
          bg="$bgSubdued"
          py="$6"
          flex={1}
          borderRadius="$3"
          borderCurve="continuous"
          justifyContent="center"
        >
          {isLoadingBookmarks ? (
            <Skeleton w="100%" />
          ) : (
            <SizableText
              size="$bodyLg"
              color="$textDisabled"
              textAlign="center"
            >
              {intl.formatMessage({
                id: ETranslations.explore_no_boomark,
              })}
            </SizableText>
          )}
        </Stack>
      )}
    </Stack>
  );
}
