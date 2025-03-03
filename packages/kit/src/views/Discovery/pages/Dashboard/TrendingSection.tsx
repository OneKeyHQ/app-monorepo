import { useCallback, useMemo } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { SizableText, Skeleton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { DashboardSectionHeader } from './DashboardSectionHeader';
import { TrendingSectionItems } from './TrendingSectionItems';

import type { IMatchDAppItemType } from '../../types';

export function TrendingSection({
  handleOpenWebSite,
}: {
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const { result: trendingData, run: refreshTrendingData } = usePromiseResult<
    IDApp[]
  >(
    async () => {
      const data =
        await backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData();
      return data.trending || [];
    },
    [],
    {
      watchLoading: true,
    },
  );

  const onPressMore = useCallback(() => {
    // Navigate to a trending view if needed
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.SearchModal,
      params: {
        url: 'trending',
      },
    });
  }, [navigation]);

  const dataSource = useMemo<IDApp[]>(() => trendingData ?? [], [trendingData]);

  const isLoadingTrending = isNil(trendingData);
  const hasTrendingItems = dataSource.length > 0;

  return (
    <Stack minHeight="$40">
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading selected>
          Trending
        </DashboardSectionHeader.Heading>
      </DashboardSectionHeader>

      {hasTrendingItems ? (
        <TrendingSectionItems
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
          {isLoadingTrending ? (
            <Skeleton w="100%" />
          ) : (
            <SizableText
              size="$bodyLg"
              color="$textDisabled"
              textAlign="center"
            >
              No trending apps
            </SizableText>
          )}
        </Stack>
      )}
    </Stack>
  );
}
