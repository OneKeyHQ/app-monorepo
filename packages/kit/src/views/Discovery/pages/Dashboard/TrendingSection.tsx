import { useMemo } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { SizableText, Skeleton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { DashboardSectionHeader } from './DashboardSectionHeader';
import { TrendingSectionItems } from './TrendingSectionItems';

import type { IMatchDAppItemType } from '../../types';

export function TrendingSection({
  handleOpenWebSite,
}: {
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
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
  const dataSource = useMemo<IDApp[]>(() => trendingData ?? [], [trendingData]);

  const isLoadingTrending = isNil(trendingData);
  const hasTrendingItems = dataSource.length > 0;

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
