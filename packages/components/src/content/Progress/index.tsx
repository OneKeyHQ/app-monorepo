import { useEffect, useState } from 'react';

import { Progress as TMProgress } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ProgressProps as TMProgressProps } from 'tamagui';

export type IProgressProps = {
  size?: 'small' | 'medium';
} & Omit<TMProgressProps, 'size'>;

const useProgressValue = platformEnv.isNative
  ? (value: number | null | undefined) => {
      const [val, setVal] = useState(platformEnv.isNative ? undefined : value);
      useEffect(() => {
        setTimeout(() => {
          setVal(!value || value < 0.1 ? 0.1 : value);
        }, 10);
      }, [value]);
      return val;
    }
  : (value: number | null | undefined) => value;

export const Progress = ({ size, value, ...props }: IProgressProps) => {
  const val = useProgressValue(value);

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
