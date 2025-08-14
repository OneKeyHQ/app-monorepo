import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TimeRangeSelector } from './components/TimeRangeSelector';
import { TransactionRow } from './components/TransactionRow';
import { VolumeRow } from './components/VolumeRow';
import { createTimeRangeOption } from './utils/createTimeRangeOption';
import { formatTokenActivityData } from './utils/formatTokenActivityData';

const defaultTimeRangeConfigs: Array<{
  labelKey: string;
  value: string;
}> = [
  {
    labelKey: '1H',
    value: '1h',
  },
  {
    labelKey: '4H',
    value: '4h',
  },
  {
    labelKey: '8H',
    value: '8h',
  },
  {
    labelKey: '24H',
    value: '24h',
  },
];

export function TokenActivityOverview() {
  const intl = useIntl();
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const { tokenDetail, isLoading } = useTokenDetail();
  const needShowLoading = isLoading && !tokenDetail?.buy1mCount;

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
      label: config.labelKey,
      value: config.value,
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
    <Stack gap="$5" px="$5" py="$4">
      <TimeRangeSelector
        options={timeRangeOptions}
        value={selectedTimeRange}
        onChange={(value) => setSelectedTimeRange(value)}
        isLoading={needShowLoading}
      />
      {tokenDetail ? (
        <>
          <TransactionRow
            label={intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions,
            })}
            buyCount={buys}
            sellCount={sells}
            totalCount={totalTransactions}
            isLoading={needShowLoading}
          />
          <VolumeRow
            label={intl
              .formatMessage({
                id: ETranslations.market_volume_percentage,
              })
              .replace('%', '')
              .trim()}
            buyVolume={buyVolume}
            sellVolume={sellVolume}
            totalVolume={totalVolume}
            isLoading={needShowLoading}
          />
        </>
      ) : null}
    </Stack>
  );
}
