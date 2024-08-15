import { Progress as TMProgress } from 'tamagui';

import type { ProgressProps as TMProgressProps } from 'tamagui';

export type IProgressProps = {
  size?: 'small' | 'medium';
} & Omit<TMProgressProps, 'size'>;

export const Progress = ({ size, value, ...props }: IProgressProps) => (
  <TMProgress
    backgroundColor="$neutral5"
    value={value}
    h={size === 'medium' ? '$1' : '$0.5'}
    {...props}
  >
    <TMProgress.Indicator
      animation="quick"
      backgroundColor="$bgPrimary"
      borderRadius="$full"
    />
  </TMProgress>
);
