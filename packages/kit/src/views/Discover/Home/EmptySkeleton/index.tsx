import { memo } from 'react';

import { Box, CustomSkeleton } from '@onekeyhq/components';

export const EmptySkeletonContent = () => {
  const data = [1, 2, 3, 4];
  return (
    <Box py="2">
      {data.map((i) => (
        <Box
          key={i}
          px="4"
          w="full"
          flexDirection="row"
          alignItems="center"
          mb="4"
        >
          <Box mr="3">
            <Box w="12" h="12" borderRadius={12} overflow="hidden">
              <CustomSkeleton />
            </Box>
          </Box>
          <Box flex="1">
            <Box h="4" borderRadius={8} mb="3" overflow="hidden">
              <CustomSkeleton />
            </Box>
            <Box h="3" borderRadius={6} overflow="hidden" width="70%">
              <CustomSkeleton />
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export const EmptySkeleton = memo(EmptySkeletonContent);
