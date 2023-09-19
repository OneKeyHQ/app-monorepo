import type { ComponentProps, FC } from 'react';

import { Box, CustomSkeleton } from '@onekeyhq/components';

import { useAppSelector } from '../../../../hooks';

type SwapLoadingSkeletonProps = ComponentProps<typeof Box>;

export const SwapLoadingSkeleton: FC<SwapLoadingSkeletonProps> = ({
  children,
  ...rest
}) => {
  const loading = useAppSelector((s) => s.swap.loading);
  return loading ? (
    <Box overflow="hidden" {...rest}>
      <CustomSkeleton />
    </Box>
  ) : (
    <Box>{children}</Box>
  );
};
