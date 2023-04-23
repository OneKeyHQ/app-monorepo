import type { FC } from 'react';

import { SegmentedControl, useThemeValue } from '@onekeyhq/components';

import type { MessageDescriptor } from 'react-intl';

export const TIMEOPTIONS = ['1D', '1W', '1M', '1Y', 'All'];
export const TIMEOPTIONS_VALUE = ['1', '7', '30', '365', 'max'];
export const TIMEOPTIONS_MESSAGEID: MessageDescriptor['id'][] = [
  'content__past_24_hours',
  'content__past_7_days',
  'content__past_month',
  'content__past_year',
  'content__since_str',
];

type TimeControlProps = {
  selectedIndex: number;
  onTimeChange(time: string): void;
  enabled?: boolean;
};

const TimeControl: FC<TimeControlProps> = ({
  selectedIndex,
  onTimeChange,
  enabled,
}) => {
  const bgColor = useThemeValue('background-default');

  return (
    <SegmentedControl
      enabled={enabled}
      style={{ marginTop: 5 }}
      values={TIMEOPTIONS}
      onValueChange={onTimeChange}
      selectedIndex={selectedIndex}
      backgroundColor={bgColor}
    />
  );
};
TimeControl.displayName = 'TimeControl';
export default TimeControl;
