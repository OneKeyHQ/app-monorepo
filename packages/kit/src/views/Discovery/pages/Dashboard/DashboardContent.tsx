import { useCallback, useMemo } from 'react';

import { ScrollView, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EDiscoveryModalRoutes } from '../../router/Routes';

import { Banner } from './Banner';
import { BookmarksAndHistoriesSection } from './BookmarksAndHistoriesSection';
import { SuggestedAndExploreSection } from './SuggestedAndExploreSection';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

function DashboardContent({
  onScroll,
}: {
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;
  const { result: bookmarksData, run: refreshBrowserBookmark } =
    usePromiseResult(
      async () =>
        backgroundApiProxy.serviceDiscovery.getBookmarkData({
          generateIcon: true,
          sliceCount: 8,
        }),
      [],
    );

  const { result: historiesData, run: refreshBrowserHistory } =
    usePromiseResult(
      async () =>
        backgroundApiProxy.serviceDiscovery.getHistoryData({
          generateIcon: true,
          sliceCount: 8,
        }),
      [],
    );

  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    if (isFocus) {
      // Execute the `usePromiseResult` in the nextTick because the focus state may not have been updated.
      setTimeout(() => {
        void refreshBrowserBookmark();
        void refreshBrowserHistory();
      });
    }
  });

  const onPressMore = useCallback(
    (isHistoriesView: boolean) => {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: isHistoriesView
          ? EDiscoveryModalRoutes.HistoryListModal
          : EDiscoveryModalRoutes.BookmarkListModal,
      });
    },
    [navigation],
  );

  const content = useMemo(
    () => (
      <>
        <Banner />
        <BookmarksAndHistoriesSection
          bookmarksData={bookmarksData}
          historiesData={historiesData}
          onPressMore={onPressMore}
          handleOpenWebSite={({ webSite }) =>
            handleOpenWebSite({
              webSite,
              navigation,
              shouldPopNavigation: false,
            })
          }
        />
        <SuggestedAndExploreSection />
      </>
    ),
    [bookmarksData, historiesData, onPressMore, handleOpenWebSite, navigation],
  );

  if (platformEnv.isNative) {
    return (
      <ScrollView onScroll={onScroll as any} scrollEventThrottle={16}>
        {content}
      </ScrollView>
    );
  }

  return <Stack>{content}</Stack>;
}

export default DashboardContent;
