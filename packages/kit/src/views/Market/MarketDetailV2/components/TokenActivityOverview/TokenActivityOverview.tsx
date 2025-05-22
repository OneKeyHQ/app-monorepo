import { useState } from 'react';

import { Stack } from '@onekeyhq/components';
// import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { ActivityRow } from './ActivityRow';
import { TimeRangeSelector } from './TimeRangeSelector';

// Mock data for demonstration purposes
const timeRangeOptions = [
  { label: '5m', value: '5m', percentageChange: '-0.07%', isPositive: false },
  { label: '1h', value: '1h', percentageChange: '-0.52%', isPositive: false },
  { label: '4h', value: '4h', percentageChange: '+1.59%', isPositive: true },
  { label: '24h', value: '24h', percentageChange: '+0.60%', isPositive: true },
];

// const activityData = [
//   {
//     label: 'Transactions: 81',
//     buyValue: 'Buys (48)',
//     sellValue: 'Sells (33)',
//     buyPercentage: (48 / 81) * 100,
//   },
//   {
//     label: 'Turnover: $52.14K',
//     buyValue: 'Buy ($51.04K)',
//     sellValue: 'Sell ($695.58)',
//     buyPercentage: (51.04 / 52.14) * 100,
//   },
//   {
//     label: 'Traders: 24',
//     buyValue: 'Buyers (16)',
//     sellValue: 'Sellers (16)',
//     buyPercentage: (16 / 24) * 100,
//   },
// ];

interface ITokenActivityOverviewProps {
  tokenDetail?: IMarketTokenDetail;
}

export function TokenActivityOverview({
  tokenDetail,
}: ITokenActivityOverviewProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  // In a real application, this state would be managed by useState or a global state manager

  const buys = Number(tokenDetail?.buy1hCount) || 0;
  const sells = Number(tokenDetail?.sell1hCount) || 0;
  const buyVolume = Number(tokenDetail?.volumeBuy1h) || 0;
  const sellVolume = Number(tokenDetail?.volumeSell1h) || 0;
  // Assuming 'traders' might be derived or fetched differently,
  // For now, let's use buys and sells as a proxy or acknowledge it might be unavailable
  // For simplicity, we'll calculate total traders based on available buy/sell counts if individual buyer/seller counts aren't directly in marketV2.IMarketTokenDetail
  // If 'buyers' and 'sellers' distinct counts are needed and not available, this part needs rethinking.
  // Based on marketV2.ts, distinct buyer/seller counts are not directly available per time range like buy1hCount.
  // We will use the sum of buy and sell actions for "Traders" for now.
  const buyersCount = buys; // Simplified: assuming each buy action is a unique buyer for this period
  const sellersCount = sells; // Simplified: assuming each sell action is a unique seller for this period

  const totalTransactions = buys + sells;
  const totalTurnover = buyVolume + sellVolume;
  // This is a simplification, real total traders count might need specific data field
  const totalTraders = buyersCount + sellersCount;

  const activityData = tokenDetail
    ? [
        {
          label: `Transactions (1h): ${totalTransactions}`,
          buyValue: `Buys (${buys})`,
          sellValue: `Sells (${sells})`,
          buyPercentage:
            totalTransactions > 0 ? (buys / totalTransactions) * 100 : 0,
        },
        {
          label: `Turnover (1h): $${totalTurnover.toFixed(2)}`, // Assuming volume is in USD, adjust if not. marketV2 types suggest string, so conversion and formatting is key.
          buyValue: `Buy ($${buyVolume.toFixed(2)})`,
          sellValue: `Sell ($${sellVolume.toFixed(2)})`,
          buyPercentage:
            totalTurnover > 0 ? (buyVolume / totalTurnover) * 100 : 0,
        },
        // If distinct trader counts are not available, this section might need to be revised or removed.
        // For now, using the simplified totalTraders
        {
          label: `Traders (1h): ${totalTraders}`,
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
        onChange={setSelectedTimeRange}
      />
      {activityData.map((activity, index) => (
        <ActivityRow
          key={index} // In a real app, use a more stable key if possible
          label={activity.label}
          buyValue={activity.buyValue}
          sellValue={activity.sellValue}
          buyPercentage={activity.buyPercentage}
        />
      ))}
    </Stack>
  );
}
