import { Progress as TMProgress } from 'tamagui';

import type { ProgressProps as TMProgressProps } from 'tamagui';

export type IProgressProps = {
  size?: 'small' | 'medium';
} & TMProgressProps;

export const Progress = ({ size, ...props }: IProgressProps) => (
  <TMProgress
    backgroundColor="$neutral5"
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
