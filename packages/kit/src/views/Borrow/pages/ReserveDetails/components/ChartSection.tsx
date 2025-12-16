import { useMemo, useState } from 'react';

import { isEmpty } from 'lodash';

import {
  Divider,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ApyChartBase } from '@onekeyhq/kit/src/views/Staking/components/ApyChartBase';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import type {
  IApyHistoryItem,
  IBorrowReserveDetail,
} from '@onekeyhq/shared/types/staking';

type ITimePeriod = 'week' | 'month' | 'quarter' | 'year';

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
  const [timePeriod, setTimePeriod] = useState<ITimePeriod>('week');
  const supplyLineColor = '#008347D6';
  const borrowLineColor = '#DA8A00C9';
  const lineWidth = 2;

  const { result: apyHistory = [], isLoading } = usePromiseResult(
    async () => {
      const apyHistoryItems =
        await backgroundApiProxy.serviceStaking.getBorrowApyHistory({
          networkId,
          provider,
          marketAddress,
          reserveAddress,
          days: timePeriod,
        });

      return apyHistoryItems.items ?? [];
    },
    [networkId, provider, marketAddress, reserveAddress, timePeriod],
    { watchLoading: true },
  );

  const { supplyHistory, borrowHistory, latestSupplyApy, latestBorrowApy } =
    useMemo(() => {
      if (isEmpty(apyHistory)) {
        return {
          supplyHistory: [],
          borrowHistory: [],
          latestSupplyApy: '0',
          latestBorrowApy: '0',
        };
      }
      const supply: IApyHistoryItem[] = [];
      const borrow: IApyHistoryItem[] = [];
      apyHistory?.forEach((item) => {
        supply.push({
          apy: item.supplyApy,
          timestamp: item.timestamp,
        });
        borrow.push({
          apy: item.borrowApy,
          timestamp: item.timestamp,
        });
      });

      const latest = apyHistory[apyHistory.length - 1];

      return {
        supplyHistory: supply,
        borrowHistory: borrow,
        latestSupplyApy: latest?.supplyApy ?? '0',
        latestBorrowApy: latest?.borrowApy ?? '0',
      };
    }, [apyHistory]);

  const timePeriodOptions = useMemo(
    () => [
      { label: '1W', value: 'week' as ITimePeriod },
      { label: '1M', value: 'month' as ITimePeriod },
      { label: '3M', value: 'quarter' as ITimePeriod },
      { label: '1Y', value: 'year' as ITimePeriod },
    ],
    [],
  );

  return (
    <YStack gap="$6" pt="$4">
      {/* Supply APY Chart */}
      <YStack gap="$3">
        <XStack jc="space-between" ai="center">
          <SizableText size="$headingLg">
            {Number(latestSupplyApy).toFixed(2)}% Supply APY
          </SizableText>
          <SegmentControl
            value={timePeriod}
            options={timePeriodOptions}
            onChange={(value) => setTimePeriod(value as ITimePeriod)}
          />
        </XStack>
        <ApyChartBase
          data={supplyHistory}
          isLoading={isLoading}
          lineColor={supplyLineColor}
          topColor="#42FFA426"
          bottomColor="#42FFA400"
          lineWidth={lineWidth}
          showPriceScale
        />

        {/* Supply Metrics */}
        {details ? (
          <XStack flexWrap="wrap" m="$-3">
            <GridItem
              title={{ text: 'Max LTV' }}
              description={{ text: details.supply.maxLtv }}
            />
            <GridItem
              title={{ text: 'Liquidation LTV' }}
              description={{ text: details.supply.liquidationLtv }}
            />
            <GridItem
              title={{ text: 'Soft Liquidations' }}
              description={{ text: details.supply.softLiquidation }}
            />
          </XStack>
        ) : null}
      </YStack>

      <Divider />

      {/* Borrow APY Chart */}
      <YStack gap="$3">
        <SizableText size="$headingLg">
          {Number(latestBorrowApy).toFixed(2)}% Borrow APY
        </SizableText>
        <ApyChartBase
          data={borrowHistory}
          isLoading={isLoading}
          lineColor={borrowLineColor}
          topColor="#BF700026"
          bottomColor="#BF700000"
          lineWidth={lineWidth}
          showPriceScale
        />
      </YStack>
    </YStack>
  );
}
