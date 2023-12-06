import { Progress as TMProgress } from 'tamagui';

import type { ProgressProps as TMProgressProps } from 'tamagui';

export type IProgressProps = TMProgressProps;

export const Progress = ({ size, ...props }: IProgressProps) => (
  <TMProgress backgroundColor="$neutral5" h="$0.5" {...props}>
    <TMProgress.Indicator
      animation="quick"
      backgroundColor="$bgPrimary"
      borderRadius="$full"
    />
  </TMProgress>
);
