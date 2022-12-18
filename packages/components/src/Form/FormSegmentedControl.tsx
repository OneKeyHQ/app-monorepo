import type { FC } from 'react';

import SegmentedControl, {
  type SegmentedControlProps,
} from '../SegmentedControl';

type FormSegmentedControlProps = Omit<
  SegmentedControlProps,
  'selectedIndex'
> & {
  value?: number;
};

export const FormSegmentedControl: FC<FormSegmentedControlProps> = ({
  value,
  ...props
}) => <SegmentedControl selectedIndex={value ?? 0} {...props} />;
