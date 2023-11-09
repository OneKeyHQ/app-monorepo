import { Progress as TMProgress } from 'tamagui';

import type { ProgressProps as TMProgressProps } from 'tamagui';

type IProgressProps = TMProgressProps;

export const Progress = ({ size, ...props }: IProgressProps) => (
  <TMProgress value={50} backgroundColor="$neutral5" {...props} h="$1">
    <TMProgress.Indicator
      animation="quick"
      backgroundColor="$bgPrimary"
      borderRadius="$full"
    />
  </TMProgress>
);
