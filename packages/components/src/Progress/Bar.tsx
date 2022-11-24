import React, { ComponentProps, FC } from 'react';

import { Progress as NBProgress } from 'native-base';

export type ProgressProps = {
  value: number;
} & ComponentProps<typeof NBProgress>;

export const defaultProps = {
  progress: 0,
  rounded: 10,
  size: 'xs',
} as const;

const Progress: FC<ProgressProps> = ({
  value,
  width,
  height,
  rounded,
  ...props
}) => (
  <NBProgress
    value={value}
    width={width}
    height={height}
    rounded={rounded}
    {...props}
    bg="surface-neutral-default"
    _filledTrack={{
      bg: 'interactive-default',
    }}
  />
);

Progress.defaultProps = defaultProps;
export default Progress;
