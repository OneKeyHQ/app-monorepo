import type { ISegmentControlProps } from '@onekeyhq/components';
import { SegmentControl } from '@onekeyhq/components';

import type { ITimePeriod } from '../hooks/useBorrowChartData';

type IApyChartTimePeriodSelectorProps = Omit<
  ISegmentControlProps,
  'value' | 'options' | 'onChange'
> & {
  value: ITimePeriod;
  options: Array<{ label: string; value: ITimePeriod }>;
  onChange: (value: ITimePeriod) => void;
};

export function ApyChartTimePeriodSelector({
  value,
  options,
  onChange,
  ...rest
}: IApyChartTimePeriodSelectorProps) {
  return (
    <SegmentControl
      value={value}
      options={options}
      onChange={(nextValue) => onChange(nextValue as ITimePeriod)}
      slotBackgroundColor="$bg"
      activeBackgroundColor="$bgActive"
      activeTextColor="$text"
      {...rest}
    />
  );
}
