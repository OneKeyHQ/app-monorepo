import { useMemo, useState } from 'react';

import {
  Badge,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ApyChartBase } from '@onekeyhq/kit/src/views/Staking/components/ApyChartBase';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { CapUsageChart } from '../../../components/CapUsageChart';

import { DetailsSectionContainer } from './DetailsSectionContainer';
import { InterestRateModelSection } from './InterestRateModelSection';

type ITimePeriod = 'week' | 'month' | 'quarter' | 'year';

interface IChartSectionProps {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  details?: IBorrowReserveDetail;
  utilizationRatio: string;
}

export function ChartSection({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  details,
  utilizationRatio,
}: IChartSectionProps) {
  const [supplyTimePeriod, setSupplyTimePeriod] = useState<ITimePeriod>('week');
  const [borrowTimePeriod, setBorrowTimePeriod] = useState<ITimePeriod>('week');
  const supplyLineColor = '#008347D6';
  const borrowLineColor = '#DA8A00C9';
  const lineWidth = 2;

  const { result: supplyHistory = [], isLoading: isSupplyLoading } =
    usePromiseResult(
      async () => {
        const apyHistoryItems =
          await backgroundApiProxy.serviceStaking.getBorrowApyHistory({
            networkId,
            provider,
            marketAddress,
            reserveAddress,
            action: 'supply',
            days: supplyTimePeriod,
          });

        return apyHistoryItems.items ?? [];
      },
      [networkId, provider, marketAddress, reserveAddress, supplyTimePeriod],
      { watchLoading: true, undefinedResultIfReRun: true },
    );

  const { result: borrowHistory = [], isLoading: isBorrowLoading } =
    usePromiseResult(
      async () => {
        const apyHistoryItems =
          await backgroundApiProxy.serviceStaking.getBorrowApyHistory({
            networkId,
            provider,
            marketAddress,
            reserveAddress,
            action: 'borrow',
            days: borrowTimePeriod,
          });

        return apyHistoryItems.items ?? [];
      },
      [networkId, provider, marketAddress, reserveAddress, borrowTimePeriod],
      { watchLoading: true, undefinedResultIfReRun: true },
    );

  const { latestSupplyApy, latestBorrowApy } = useMemo(() => {
    const latestSupply = supplyHistory[supplyHistory.length - 1];
    const latestBorrow = borrowHistory[borrowHistory.length - 1];

    return {
      latestSupplyApy: latestSupply?.apy ?? '0',
      latestBorrowApy: latestBorrow?.apy ?? '0',
    };
  }, [supplyHistory, borrowHistory]);

  const timePeriodOptions = useMemo(
    () => [
      { label: '1W', value: 'week' as ITimePeriod },
      { label: '1M', value: 'month' as ITimePeriod },
      { label: '3M', value: 'quarter' as ITimePeriod },
      { label: '1Y', value: 'year' as ITimePeriod },
    ],
    [],
  );

  const supplyBadge = details ? (
    <Badge badgeType={details.supply.canBeCollateral ? 'success' : 'default'}>
      <Badge.Text>
        {details.supply.canBeCollateral
          ? 'Can be collateral'
          : 'Not collateral'}
      </Badge.Text>
    </Badge>
  ) : null;

  const borrowBadge = details ? (
    <Badge badgeType={details.borrow.canBeBorrowed ? 'success' : 'default'}>
      <Badge.Text>
        {details.borrow.canBeBorrowed ? 'Borrowable' : 'Not borrowable'}
      </Badge.Text>
    </Badge>
  ) : null;

  return (
    <YStack gap="$8">
      <DetailsSectionContainer title="Supply info" titleAfter={supplyBadge}>
        <YStack gap="$6" pt="$4">
          {/* Supply Cap Usage */}
          {details?.supply.usage ? (
            <CapUsageChart
              percentage={details.supply.usage.percentage}
              label="Supply cap usage"
              title={details.supply.usage.title}
              description={details.supply.usage.description}
              tooltip={details.supply.usage.tooltip}
            />
          ) : null}

          {/* Supply APY Chart */}
          <YStack gap="$3">
            <XStack jc="space-between" ai="center">
              <SizableText size="$headingLg">
                {Number(latestSupplyApy).toFixed(2)}% Supply APY
              </SizableText>
              <SegmentControl
                value={supplyTimePeriod}
                options={timePeriodOptions}
                onChange={(value) => setSupplyTimePeriod(value as ITimePeriod)}
              />
            </XStack>
            <ApyChartBase
              data={supplyHistory}
              isLoading={isSupplyLoading}
              lineColor={supplyLineColor}
              topColor="#42FFA426"
              bottomColor="#42FFA400"
              lineWidth={lineWidth}
              showPriceScale
              showDivider={false}
            />

            {/* Supply Metrics */}
            {details ? (
              <XStack flexWrap="wrap" mt="$6">
                <GridItem
                  title={{ text: 'Max LTV' }}
                  description={details.supply.maxLtv?.text}
                  tooltip={details.supply.maxLtv?.tooltip}
                />
                <GridItem
                  title={{ text: 'Liquidation LTV' }}
                  description={details.supply.liquidationLtv?.text}
                  tooltip={details.supply.liquidationLtv?.tooltip}
                />
                <GridItem
                  title={{ text: 'Soft Liquidations' }}
                  description={details.supply.softLiquidation?.text}
                  tooltip={details.supply.softLiquidation?.tooltip}
                />
              </XStack>
            ) : null}
          </YStack>
        </YStack>
      </DetailsSectionContainer>

      <DetailsSectionContainer
        title="Borrow info"
        titleAfter={borrowBadge}
        showDivider={false}
      >
        <YStack gap="$6" pt="$4">
          {/* Borrow Cap Usage */}
          {details?.borrow.usage ? (
            <CapUsageChart
              percentage={details.borrow.usage.percentage}
              label="Borrow cap usage"
              title={details.borrow.usage.title}
              description={details.borrow.usage.description}
              tooltip={details.borrow.usage.tooltip}
            />
          ) : null}

          {/* Borrow APY Chart */}
          <YStack gap="$3">
            <XStack jc="space-between" ai="center">
              <SizableText size="$headingLg">
                {Number(latestBorrowApy).toFixed(2)}% Borrow APY
              </SizableText>
              <SegmentControl
                value={borrowTimePeriod}
                options={timePeriodOptions}
                onChange={(value) => setBorrowTimePeriod(value as ITimePeriod)}
              />
            </XStack>
            <ApyChartBase
              data={borrowHistory}
              isLoading={isBorrowLoading}
              lineColor={borrowLineColor}
              topColor="#BF700026"
              bottomColor="#BF700000"
              lineWidth={lineWidth}
              showPriceScale
            />
          </YStack>
        </YStack>
      </DetailsSectionContainer>

      <InterestRateModelSection
        networkId={networkId}
        provider={provider}
        marketAddress={marketAddress}
        reserveAddress={reserveAddress}
        utilizationRatio={utilizationRatio}
      />
    </YStack>
  );
}
