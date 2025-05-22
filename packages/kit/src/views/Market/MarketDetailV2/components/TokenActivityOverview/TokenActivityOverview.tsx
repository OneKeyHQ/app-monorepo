import { Stack } from '@onekeyhq/components';

import { ActivityRow } from './ActivityRow';
import { TimeRangeSelector } from './TimeRangeSelector';

// Mock data for demonstration purposes
const timeRangeOptions = [
  { label: '5m', value: '5m', percentageChange: '-0.07%', isPositive: false },
  { label: '1h', value: '1h', percentageChange: '-0.52%', isPositive: false },
  { label: '4h', value: '4h', percentageChange: '+1.59%', isPositive: true },
  { label: '24h', value: '24h', percentageChange: '+0.60%', isPositive: true },
];

const activityData = [
  {
    label: 'Transactions: 81',
    buyValue: 'Buys (48)',
    sellValue: 'Sells (33)',
    buyPercentage: (48 / 81) * 100,
  },
  {
    label: 'Turnover: $52.14K',
    buyValue: 'Buy ($51.04K)',
    sellValue: 'Sell ($695.58)',
    buyPercentage: (51.04 / 52.14) * 100,
  },
  {
    label: 'Traders: 24',
    buyValue: 'Buyers (16)',
    sellValue: 'Sellers (16)',
    buyPercentage: (16 / 24) * 100,
  },
];

export function TokenActivityOverview() {
  // In a real application, this state would be managed by useState or a global state manager
  const selectedTimeRange = '4h';
  const handleTimeRangeChange = (value: string | number) => {
    console.log('Selected time range:', value);
    // Logic to update selectedTimeRange would go here
  };

  return (
    <Stack space="$5" p="$4">
      <TimeRangeSelector
        options={timeRangeOptions}
        value={selectedTimeRange}
        onChange={handleTimeRangeChange}
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
