import type { ComponentProps, FC } from 'react';

import { Progress as NBProgress } from 'native-base';

export type ProgressProps = {
  value: number;
} & ComponentProps<typeof NBProgress>;

export const defaultProps = {
  progress: 0,
  rounded: 10,
  size: 'xs',
} as const;

const Bar: FC<ProgressProps> = ({
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

Bar.defaultProps = defaultProps;
export default Bar;
