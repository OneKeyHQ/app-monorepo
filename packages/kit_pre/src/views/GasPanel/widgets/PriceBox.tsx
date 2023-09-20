import { Box, Center, CustomSkeleton, Typography } from '@onekeyhq/components';

import { priceUnit } from '../config';

import { useNetworkPrices } from './hooks';

export const PriceBox = ({ networkId }: { networkId?: string }) => {
  const price = useNetworkPrices(networkId);
  return (
    <Center
      borderRadius={12}
      borderColor="border-subdued"
      borderWidth={1}
      w="12"
      h="12"
    >
      {price ? (
        <Typography.Body2Strong lineHeight={14} color="text-warning">
          {Math.ceil(Number(price))}
        </Typography.Body2Strong>
      ) : (
        <Box w="8" h="3" mb="1" overflow="hidden" borderRadius={12}>
          <CustomSkeleton />
        </Box>
      )}
      <Typography.CaptionStrong lineHeight={12} color="text-warning">
        {(networkId && priceUnit[networkId]) || 'Gwei'}
      </Typography.CaptionStrong>
    </Center>
  );
};
