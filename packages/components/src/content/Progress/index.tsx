import { useEffect, useState } from 'react';

import { Progress as TMProgress } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ProgressProps as TMProgressProps } from 'tamagui';

export type IProgressProps = {
  size?: 'small' | 'medium';
} & Omit<TMProgressProps, 'size'>;

// https://github.com/tamagui/tamagui/issues/2753
// https://github.com/tamagui/tamagui/issues/2847
// Enabling animation on Native platforms causes the progress bar to fail initial rendering
export function Progress({ size, ...props }: IProgressProps) {
  return (
    <TMProgress
      backgroundColor="$neutral5"
      h={size === 'medium' ? '$1' : '$0.5'}
      max={100}
      animation={platformEnv.isNative ? null : undefined}
      {...props}
    >
      <TMProgress.Indicator
        animation={platformEnv.isNative ? null : 'quick'}
        backgroundColor="$bgPrimary"
        borderRadius="$full"
      />
    </TMProgress>
  );
}
