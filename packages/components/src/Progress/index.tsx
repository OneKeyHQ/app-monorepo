import { Progress as TMProgress } from 'tamagui';

import type { ProgressProps as TMProgressProps } from 'tamagui';

type ProgressProps = TMProgressProps;

export const Progress = ({ size, ...props }: ProgressProps) => (
  <TMProgress value={50} backgroundColor="$neutral5" {...props} h="$1">
    <TMProgress.Indicator
      animation="quick"
      backgroundColor="$bgPrimary"
      borderRadius="$full"
    />
  </TMProgress>
);
