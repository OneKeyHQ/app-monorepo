import { memo } from 'react';

import { Box, Skeleton } from '@onekeyhq/components';

export const AccountSectionLoadingSkeleton = memo(
  ({ isLoading }: { isLoading: boolean }) =>
    isLoading ? (
      <Box mx="2" borderRadius={12} p="2">
        <Skeleton shape="Body2" />
        <Skeleton shape="Body2" />
      </Box>
    ) : null,
);
AccountSectionLoadingSkeleton.displayName = 'AccountSectionLoadingSkeleton';
