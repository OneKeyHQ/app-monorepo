import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';

import { DashboardSectionHeader } from './DashboardSectionHeader';
import { TrendingSectionItems } from './TrendingSectionItems';

import type { IMatchDAppItemType } from '../../types';

interface ITrendingSectionProps {
  data: IDApp[];
  isLoading: boolean;
}

export function TrendingSection({
  data = [],
  isLoading = false,
}: ITrendingSectionProps) {
  const intl = useIntl();
  const handleWebSite = useWebSiteHandler();
  const dataSource = useMemo<IDApp[]>(() => data ?? [], [data]);

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

      <TrendingSectionItems
        isLoading={isLoading}
        dataSource={dataSource}
        handleOpenWebSite={handleOpenWebSite}
      />
    </Stack>
  );
}
