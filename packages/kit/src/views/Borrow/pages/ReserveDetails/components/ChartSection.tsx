import { useState } from 'react';

import { useIntl } from 'react-intl';

import { YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import {
  useApyChartColors,
  useApyLabels,
  useBorrowApyHistory,
  useBorrowBadges,
  useTimePeriodOptions,
} from '../hooks/useBorrowChartData';

import { ApyChartSection } from './ApyChartSection';
import { DetailsSectionContainer } from './DetailsSectionContainer';
import { InterestRateModelSection } from './InterestRateModelSection';

import type { ITimePeriod } from '../hooks/useBorrowChartData';

interface IChartSectionProps {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  details?: IBorrowReserveDetail;
}

export function ChartSection({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  details,
}: IChartSectionProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const [supplyTimePeriod, setSupplyTimePeriod] = useState<ITimePeriod>('week');
  const [borrowTimePeriod, setBorrowTimePeriod] = useState<ITimePeriod>('week');

  const apyChartColors = useApyChartColors();
  const timePeriodOptions = useTimePeriodOptions();
  const { supplyApyLabel, borrowApyLabel } = useApyLabels();
  const { supplyBadge, borrowBadge } = useBorrowBadges(details);

  const supplyData = useBorrowApyHistory({
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    action: 'supply',
    timePeriod: supplyTimePeriod,
  });

  const borrowData = useBorrowApyHistory({
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    action: 'borrow',
    timePeriod: borrowTimePeriod,
  });

  return (
    <YStack gap="$8">
      <DetailsSectionContainer
        title={intl.formatMessage({ id: ETranslations.defi_supply_info })}
        titleAfter={supplyBadge}
        showDivider={gtMd}
      >
        <ApyChartSection
          apyValue={supplyData.latestApy}
          apyLabel={supplyApyLabel}
          history={supplyData.history}
          isLoading={supplyData.isLoading ?? false}
          timePeriod={supplyTimePeriod}
          timePeriodOptions={timePeriodOptions}
          onTimePeriodChange={setSupplyTimePeriod}
          lineColor={apyChartColors.supply.line}
          topColor={apyChartColors.supply.top}
          bottomColor={apyChartColors.supply.bottom}
          lineWidth={apyChartColors.lineWidth}
          showDivider={false}
          capUsage={details?.supply.usage}
          capUsageLabel={intl.formatMessage({
            id: ETranslations.defi_supply_cap_usage,
          })}
          metrics={
            details
              ? {
                  maxLtv: details.supply.maxLtv,
                  liquidationLtv: details.supply.liquidationLtv,
                  softLiquidation: details.supply.softLiquidation,
                }
              : undefined
          }
          tooltipLabel={supplyApyLabel}
        />
      </DetailsSectionContainer>

      <DetailsSectionContainer
        title={intl.formatMessage({ id: ETranslations.defi_borrow_info })}
        titleAfter={borrowBadge}
        showDivider={gtMd}
      >
        <ApyChartSection
          apyValue={borrowData.latestApy}
          apyLabel={borrowApyLabel}
          history={borrowData.history}
          isLoading={borrowData.isLoading ?? false}
          timePeriod={borrowTimePeriod}
          timePeriodOptions={timePeriodOptions}
          onTimePeriodChange={setBorrowTimePeriod}
          lineColor={apyChartColors.borrow.line}
          topColor={apyChartColors.borrow.top}
          bottomColor={apyChartColors.borrow.bottom}
          lineWidth={apyChartColors.lineWidth}
          showDivider={false}
          capUsage={details?.borrow.usage}
          capUsageLabel={intl.formatMessage({
            id: ETranslations.defi_borrow_cap_usage,
          })}
          tooltipLabel={borrowApyLabel}
        />
      </DetailsSectionContainer>

      <InterestRateModelSection
        networkId={networkId}
        provider={provider}
        marketAddress={marketAddress}
        reserveAddress={reserveAddress}
        utilizationRatio={details?.utilizationRatio}
      />
    </YStack>
  );
}
