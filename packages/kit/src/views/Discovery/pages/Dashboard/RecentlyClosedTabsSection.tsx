import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';
import { useDisplayHomePageFlag } from '../../hooks/useWebTabs';
import { HistoryListItem } from '../HistoryListModal/HistoryListItem';

import { DashboardSectionHeader } from './DashboardSectionHeader';

import type { IBrowserHistory } from '../../types';

const RECENTLY_CLOSED_TAB_LIMIT = 5;

function RecentlyClosedTabsSectionContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const handleWebSite = useWebSiteHandler();
  const { displayHomePage } = useDisplayHomePageFlag();

  const { result: historyData = [], run: refreshHistory } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceDiscovery.fetchHistoryData(
        1,
        RECENTLY_CLOSED_TAB_LIMIT,
      ),
    [],
    {
      watchLoading: true,
      checkIsFocused: false,
    },
  );

  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    if (isFocus) {
      setTimeout(() => {
        void refreshHistory();
      });
    }
  });

  useEffect(() => {
    if (displayHomePage && platformEnv.isNative) {
      void refreshHistory();
    }
  }, [displayHomePage, refreshHistory]);

  const handlePress = useCallback(
    (item: IBrowserHistory) => {
      handleWebSite({
        webSite: {
          url: item.url,
          title: item.title,
          logo: item.logo,
          sortIndex: undefined,
        },
        enterMethod: EEnterMethod.history,
      });
    },
    [handleWebSite],
  );

  const handleSeeAllPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.HistoryListModal,
    });
  }, [navigation]);

  if (historyData.length === 0) {
    return null;
  }

  return (
    <Stack width="100%" mt="$3">
      <DashboardSectionHeader px="$pagePadding">
        <DashboardSectionHeader.Heading selected>
          {intl.formatMessage({ id: ETranslations.browser_recently_closed })}
        </DashboardSectionHeader.Heading>
        <DashboardSectionHeader.Button onPress={handleSeeAllPress}>
          {intl.formatMessage({ id: ETranslations.explore_see_all })}
        </DashboardSectionHeader.Button>
      </DashboardSectionHeader>

      <Stack py="$1">
        {historyData.slice(0, RECENTLY_CLOSED_TAB_LIMIT).map((item) => (
          <HistoryListItem
            key={item.id}
            item={item}
            testIDPrefix="browser-home-recently-closed"
            onPress={handlePress}
          />
        ))}
      </Stack>
    </Stack>
  );
}

export function RecentlyClosedTabsSection() {
  if (!platformEnv.isNative) {
    return null;
  }

  return <RecentlyClosedTabsSectionContent />;
}
