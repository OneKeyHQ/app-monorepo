import { useEffect, useMemo, useState } from 'react';

import { Stack } from '@onekeyhq/components';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { ActivityRow } from './ActivityRow';
import { TimeRangeSelector } from './TimeRangeSelector';
import { createTimeRangeOption } from './utils/createTimeRangeOption';
import { formatTokenActivityData } from './utils/formatTokenActivityData';

const defaultTimeRangeConfigs = [
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '8H', value: '8h' },
  { label: '24H', value: '24h' },
];

export function TokenActivityOverview() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const { tokenDetail } = useTokenDetail();

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
    const isCurrentSelectionValid = timeRangeOptions.some(
      (option) => option.value === selectedTimeRange,
    );

    if (!isCurrentSelectionValid && timeRangeOptions.length > 0) {
      setSelectedTimeRange(timeRangeOptions[0].value);
    }
  }, [timeRangeOptions, selectedTimeRange]);

  const { buys, sells, buyVolume, sellVolume, totalVolume } =
    formatTokenActivityData(tokenDetail, selectedTimeRange);

  const totalTransactions = buys + sells;

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
          label: `Volume (${selectedTimeRange})`,
          buyValue: `Buy`,
          sellValue: `Sell`,
          buyPercentage: totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0,
          totalVolume,
          buyVolume,
          sellVolume,
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
          totalVolume={activity.totalVolume}
          buyVolume={activity.buyVolume}
          sellVolume={activity.sellVolume}
        />
      ))}
    </Stack>
  );
}
