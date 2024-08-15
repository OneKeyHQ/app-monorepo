import { useMemo } from 'react';

import { Progress as TMProgress } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ProgressProps as TMProgressProps } from 'tamagui';

export type IProgressProps = {
  size?: 'small' | 'medium';
} & Omit<TMProgressProps, 'size'>;

export const Progress = ({ size, value, ...props }: IProgressProps) => {
  const val = useMemo(() => {
    // Fix the issue where the progress bar shows 100% when the value is 0
    if (platformEnv.isNative) {
      return !value || value < 0.1 ? 0.1 : value;
    }
    return value;
  }, [value]);
  return (
    <TMProgress
      backgroundColor="$neutral5"
      value={val}
      h={size === 'medium' ? '$1' : '$0.5'}
      max={100}
      {...props}
    >
      <TMProgress.Indicator
        animation="quick"
        backgroundColor="$bgPrimary"
        borderRadius="$full"
      />
    </TMProgress>
  );
};
