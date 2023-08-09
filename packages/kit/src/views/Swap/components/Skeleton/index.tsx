import type { ComponentProps, FC } from 'react';

import { Box, CustomSkeleton } from '@onekeyhq/components';

import { useAppSelector } from '../../../../hooks';
import { selectSwapLoading } from '../../../../store/selectors';

type SwapLoadingSkeletonProps = ComponentProps<typeof Box>;

export const SwapLoadingSkeleton: FC<SwapLoadingSkeletonProps> = ({
  children,
  ...rest
}) => {
  const loading = useAppSelector(selectSwapLoading);
  return loading ? (
    <Box overflow="hidden" {...rest}>
      <CustomSkeleton />
    </Box>
  ) : (
    <Box>{children}</Box>
  );
};
