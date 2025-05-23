import { useEffect, useMemo, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { ActivityRow } from './ActivityRow';
import { TimeRangeSelector } from './TimeRangeSelector';
import { createTimeRangeOption } from './utils/createTimeRangeOption';
import { formatTokenActivityData } from './utils/formatTokenActivityData';

interface ITokenActivityOverviewProps {
  tokenDetail?: IMarketTokenDetail;
}

const defaultTimeRangeConfigs = [
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '8H', value: '8h' },
  { label: '24H', value: '24h' },
];

export function TokenActivityOverview({
  tokenDetail,
}: ITokenActivityOverviewProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');

  const timeRangeOptions = useMemo(() => {
    const availableOptions = [
      createTimeRangeOption(tokenDetail, 'priceChange1hPercent', '1H', '1h'),
      createTimeRangeOption(tokenDetail, 'priceChange4hPercent', '4H', '4h'),
      createTimeRangeOption(tokenDetail, 'priceChange8hPercent', '8H', '8h'),
      createTimeRangeOption(tokenDetail, 'priceChange24hPercent', '24H', '24h'),
    ].filter(Boolean);

    if (availableOptions.length > 0) {
      return availableOptions;
    }

    return defaultTimeRangeConfigs.map((config) => ({
      ...config,
      percentageChange: '0.00%',
      isPositive: false,
    }));
  }, [tokenDetail]);

  useEffect(() => {
    if (
      timeRangeOptions.some((option) =>
        defaultTimeRangeConfigs.every((cfg) => cfg.label !== option.label),
      )
    ) {
      if (!timeRangeOptions.find((o) => o.value === selectedTimeRange)) {
        setSelectedTimeRange(timeRangeOptions[0].value);
      }
    } else {
      const isSelectedTimeRangeValidOrDefault = defaultTimeRangeConfigs.some(
        (config) => config.value === selectedTimeRange,
      );
      if (!isSelectedTimeRangeValidOrDefault) {
        setSelectedTimeRange('1h');
      }
    }
  }, [timeRangeOptions, selectedTimeRange]);

  const { buys, sells, buyVolume, sellVolume } = formatTokenActivityData(
    tokenDetail,
    selectedTimeRange,
  );

  // Simplified: assuming each buy/sell action is a unique buyer/seller for this period
  const buyersCount = buys;
  const sellersCount = sells;

  const totalTransactions = buys + sells;
  const totalTurnover = buyVolume + sellVolume;
  const totalTraders = buyersCount + sellersCount; // This is a simplification

  const activityData = tokenDetail
    ? [
        {
          label: `Transactions (${selectedTimeRange}): ${totalTransactions}`,
          buyValue: `Buys (${buys})`,
          sellValue: `Sells (${sells})`,
          buyPercentage:
            totalTransactions > 0 ? (buys / totalTransactions) * 100 : 0,
        },
        {
          label: `Turnover (${selectedTimeRange}): $${totalTurnover.toFixed(
            2,
          )}`,
          buyValue: `Buy ($${buyVolume.toFixed(2)})`,
          sellValue: `Sell ($${sellVolume.toFixed(2)})`,
          buyPercentage:
            totalTurnover > 0 ? (buyVolume / totalTurnover) * 100 : 0,
        },
        {
          label: `Traders (${selectedTimeRange}): ${totalTraders}`,
          buyValue: `Buyers (${buyersCount})`,
          sellValue: `Sellers (${sellersCount})`,
          buyPercentage:
            totalTraders > 0 ? (buyersCount / totalTraders) * 100 : 0,
        },
      ]
    : [];

  return (
    <Stack gap="$5" p="$4">
      <TimeRangeSelector
        options={timeRangeOptions}
        value={selectedTimeRange}
        onChange={(value) => setSelectedTimeRange(value)}
      />
      {activityData.map((activity) => (
        <ActivityRow
          key={`activity-${selectedTimeRange}-${activity.label}`}
          label={activity.label}
          buyValue={activity.buyValue}
          sellValue={activity.sellValue}
          buyPercentage={activity.buyPercentage}
        />
      ))}
    </Stack>
  );
}
