import React, { FC } from 'react';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  Pressable,
  Skeleton,
  Typography,
} from '@onekeyhq/components/src';

import { MarketTokenItem } from '../../../../store/reducers/market';
import { useMarketTokenItem } from '../../hooks/useMarketToken';

const MarketSearchTokenDestopCell: FC<{
  marketTokenId: string;
  onPress: (marketTokenItem: MarketTokenItem) => void;
}> = ({ marketTokenId, onPress }) => {
  const marketTokenItem = useMarketTokenItem({ coingeckoId: marketTokenId });
  return (
    <Pressable
      onPress={() => {
        if (marketTokenItem && onPress) onPress(marketTokenItem);
      }}
    >
      {({ isHovered, isPressed }) => (
        <Box
          p={2}
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          mr="1px"
          justifyContent={
            isHovered || isPressed ? 'space-between' : 'flex-start'
          }
          bgColor={isPressed || isHovered ? 'surface-selected' : undefined}
        >
          {marketTokenItem ? (
            <HStack space={3} alignItems="center" justifyContent="center">
              {marketTokenItem.logoURI ? (
                <Image
                  borderRadius={16}
                  src={marketTokenItem.logoURI}
                  alt={marketTokenItem.logoURI}
                  key={marketTokenItem.logoURI}
                  size={8}
                  fallbackElement={
                    <Icon name="QuestionMarkOutline" size={32} />
                  }
                />
              ) : (
                <Skeleton shape="Avatar" size={32} />
              )}
              <Typography.Body2Strong>
                {marketTokenItem.symbol}
              </Typography.Body2Strong>
              <Typography.Body2 color="text-subdued">
                {marketTokenItem.name}
              </Typography.Body2>
            </HStack>
          ) : (
            <HStack space={3} alignItems="center" justifyContent="center">
              <Skeleton shape="Avatar" size={32} />
              <Skeleton shape="Body2" />
              <Skeleton shape="Body2" />
            </HStack>
          )}
          {isHovered || isPressed ? (
            <Center
              bgColor="surface-neutral-subdued"
              w="32px"
              h="24px"
              borderRadius="6px"
            >
              <Icon name="ReplySolid" size={16} />
            </Center>
          ) : null}
        </Box>
      )}
    </Pressable>
  );
};

export default React.memo(MarketSearchTokenDestopCell);
