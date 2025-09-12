import { forwardRef } from 'react';

import { SegmentControl } from '@onekeyhq/components';

export type ITimeRangeSelectorValue = '5m' | '1h' | '4h' | '24h';

interface ITimeRangeSelectorProps {
  value: ITimeRangeSelectorValue;
  onChange: (value: ITimeRangeSelectorValue) => void;
}

const defaultOptions: { label: string; value: ITimeRangeSelectorValue }[] = [
  { label: '5m', value: '5m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '24h', value: '24h' },
];

export const TimeRangeSelector = forwardRef<any, ITimeRangeSelectorProps>(
  ({ value, onChange }, ref) => {
    const handleValueChange = (v: ITimeRangeSelectorValue) => {
      onChange(v);
    };

    return (
      <SegmentControl
        ref={ref}
        display="none"
        value={value}
        onChange={(v) => handleValueChange(v as ITimeRangeSelectorValue)}
        options={defaultOptions}
      />
    );
  },
);

TimeRangeSelector.displayName = 'TimeRangeSelector';
