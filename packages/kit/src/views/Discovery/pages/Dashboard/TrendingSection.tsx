import { useCallback, useMemo } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { SizableText, Skeleton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';

import { DashboardSectionHeader } from './DashboardSectionHeader';
import { TrendingSectionItems } from './TrendingSectionItems';

import type { IMatchDAppItemType } from '../../types';

export function TrendingSection() {
  const { result: trendingData } = usePromiseResult<IDApp[]>(
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
  const intl = useIntl();
  const handleWebSite = useWebSiteHandler();
  const dataSource = useMemo<IDApp[]>(() => trendingData ?? [], [trendingData]);

  const isLoadingTrending = isNil(trendingData);
  const hasTrendingItems = dataSource.length > 0;

  const handleOpenWebSite = useCallback(
    ({ dApp, webSite }: IMatchDAppItemType) => {
      handleWebSite({
        webSite,
        dApp,
        shouldPopNavigation: false,
        enterMethod: EEnterMethod.trending,
      });
    },
    [handleWebSite],
  );

  return (
    <Stack minHeight="$40">
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading selected>
          {intl.formatMessage({
            id: ETranslations.market_trending,
          })}
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
