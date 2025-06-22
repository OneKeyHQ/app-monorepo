import { useEffect, useMemo, useState } from 'react';

import { Stack } from '@onekeyhq/components';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TimeRangeSelector } from './components/TimeRangeSelector';
import { TransactionRow } from './components/TransactionRow';
import { VolumeRow } from './components/VolumeRow';
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

  return (
    <Stack gap="$5" p="$4">
      <TimeRangeSelector
        options={timeRangeOptions}
        value={selectedTimeRange}
        onChange={(value) => setSelectedTimeRange(value)}
      />
      {tokenDetail ? (
        <>
          <TransactionRow
            label="Transactions"
            timeRange={selectedTimeRange}
            buyCount={buys}
            sellCount={sells}
            totalCount={totalTransactions}
          />
          <VolumeRow
            label="Volume"
            timeRange={selectedTimeRange}
            buyVolume={buyVolume}
            sellVolume={sellVolume}
            totalVolume={totalVolume}
          />
        </>
      ) : null}
    </Stack>
  );
}
