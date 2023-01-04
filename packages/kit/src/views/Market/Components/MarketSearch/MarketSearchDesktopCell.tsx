import type { FC } from 'react';
import { memo } from 'react';

import {
  Box,
  Center,
  HStack,
  Icon,
  Pressable,
  Skeleton,
  Token,
  Typography,
} from '@onekeyhq/components';
import type { MarketTokenItem } from '@onekeyhq/kit/src/store/reducers/market';

import { useMarketTokenItem } from '../../hooks/useMarketToken';

const MarketSearchTokenDestopCell: FC<{
  marketTokenId: string;
  onPress: (marketTokenItem: MarketTokenItem) => void;
}> = ({ marketTokenId, onPress }) => {
  const marketTokenItem = useMarketTokenItem({
    coingeckoId: marketTokenId,
    isList: true,
  });
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
                <Token
                  size={8}
                  token={{
                    logoURI: marketTokenItem.logoURI,
                    symbol: marketTokenItem.symbol,
                    name: marketTokenItem.name,
                  }}
                />
              ) : (
                <Skeleton shape="Avatar" size={32} />
              )}
              <Typography.Body1Strong>
                {marketTokenItem.symbol}
              </Typography.Body1Strong>
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
              <Icon name="ReplyMini" size={16} />
            </Center>
          ) : null}
        </Box>
      )}
    </Pressable>
  );
};

export default memo(MarketSearchTokenDestopCell);
