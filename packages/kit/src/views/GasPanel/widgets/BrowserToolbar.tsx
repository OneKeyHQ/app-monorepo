import { Box, CustomSkeleton, Icon, Typography } from '@onekeyhq/components';

import { useNetworkPrices } from './hooks';

export const BrowserToolbar = ({ networkId }: { networkId?: string }) => {
  const price = useNetworkPrices(networkId);
  return (
    <Box flexDirection="row" alignItems="center" h="full">
      {price ? (
        <Box flexDirection="row" alignItems="center">
          <Icon name="GasIllus" size={16} color="text-warning" />
          <Box ml="1">
            <Typography.Button2 color="text-warning">
              {Math.ceil(Number(price))}
            </Typography.Button2>
          </Box>
        </Box>
      ) : (
        <Box w="8" h="3" mb="1" overflow="hidden" borderRadius={12}>
          <CustomSkeleton />
        </Box>
      )}
    </Box>
  );
};
