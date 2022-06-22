import React from 'react';

import { useIntl } from 'react-intl';

import { Box, SegmentedControl } from '@onekeyhq/components';

export type TimeOptions = '1D' | '1W' | '1M' | '1Y' | 'All';

type TimeControlProps = {
  time: TimeOptions;
  onTimeChange(time: string): void;
};

const TimeControl: React.FC<TimeControlProps> = ({ time, onTimeChange }) => {
  const intl = useIntl();
  return (
    <Box>
      <SegmentedControl
        options={[
          {
            label: '1D',
            value: '1D',
          },
          {
            label: '1W',
            value: '1W',
          },
          {
            label: '1M',
            value: '1M',
          },
          {
            label: '1Y',
            value: '1Y',
          },
          {
            label: 'All',
            value: 'All',
          },
        ]}
        onChangeValue={onTimeChange}
        defaultValue={time}
      />
    </Box>
  );
};
TimeControl.displayName = 'TimeControl';
export default TimeControl;
