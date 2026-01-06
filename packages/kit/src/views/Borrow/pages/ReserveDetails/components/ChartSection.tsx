import { useState } from 'react';

import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import {
  APY_CHART_COLORS,
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
  const [supplyTimePeriod, setSupplyTimePeriod] = useState<ITimePeriod>('week');
  const [borrowTimePeriod, setBorrowTimePeriod] = useState<ITimePeriod>('week');

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
      >
        <YStack pt="$4">
          <ApyChartSection
            apyValue={supplyData.latestApy}
            apyLabel={supplyApyLabel}
            history={supplyData.history}
            isLoading={supplyData.isLoading ?? false}
            timePeriod={supplyTimePeriod}
            timePeriodOptions={timePeriodOptions}
            onTimePeriodChange={setSupplyTimePeriod}
            lineColor={APY_CHART_COLORS.supply.line}
            topColor={APY_CHART_COLORS.supply.top}
            bottomColor={APY_CHART_COLORS.supply.bottom}
            lineWidth={APY_CHART_COLORS.lineWidth}
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
          />
        </YStack>
      </DetailsSectionContainer>

      <DetailsSectionContainer
        title={intl.formatMessage({ id: ETranslations.defi_borrow_info })}
        titleAfter={borrowBadge}
        showDivider={false}
      >
        <YStack pt="$4">
          <ApyChartSection
            apyValue={borrowData.latestApy}
            apyLabel={borrowApyLabel}
            history={borrowData.history}
            isLoading={borrowData.isLoading ?? false}
            timePeriod={borrowTimePeriod}
            timePeriodOptions={timePeriodOptions}
            onTimePeriodChange={setBorrowTimePeriod}
            lineColor={APY_CHART_COLORS.borrow.line}
            topColor={APY_CHART_COLORS.borrow.top}
            bottomColor={APY_CHART_COLORS.borrow.bottom}
            lineWidth={APY_CHART_COLORS.lineWidth}
            capUsage={details?.borrow.usage}
            capUsageLabel={intl.formatMessage({
              id: ETranslations.defi_borrow_cap_usage,
            })}
          />
        </YStack>
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
