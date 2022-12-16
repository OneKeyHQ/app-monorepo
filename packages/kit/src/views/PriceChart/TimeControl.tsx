import type { FC } from 'react';

import { SegmentedControl } from '@onekeyhq/components';

export const TIMEOPTIONS = ['1D', '1W', '1M', '1Y', 'All'];
export const TIMEOPTIONS_VALUE = ['1', '7', '30', '365', 'max'];

type TimeControlProps = {
  selectedIndex: number;
  onTimeChange(time: string): void;
  enabled?: boolean;
};

const TimeControl: FC<TimeControlProps> = ({
  selectedIndex,
  onTimeChange,
  enabled,
}) => (
  <SegmentedControl
    enabled={enabled}
    style={{ marginTop: 5 }}
    values={TIMEOPTIONS}
    onValueChange={onTimeChange}
    selectedIndex={selectedIndex}
  />
);
TimeControl.displayName = 'TimeControl';
export default TimeControl;
