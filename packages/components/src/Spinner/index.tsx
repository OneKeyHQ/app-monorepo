import type { ComponentProps, FC } from 'react';

import { Spinner as NBSpinner } from 'native-base';

import { useThemeValue } from '../Provider/hooks';

type SpinnerSize = 'sm' | 'lg';

export type BadgeProps = {
  size?: SpinnerSize;
} & ComponentProps<typeof NBSpinner>;

export const Spinner: FC<BadgeProps> = ({ ...rest }) => {
  const bgColor = useThemeValue('icon-subdued');
  return <NBSpinner color={bgColor} {...rest} />;
};
// SpinnerLoading
export default Spinner;
