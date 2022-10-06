import React, { FC, useCallback, useEffect, useState } from 'react';

import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Skeleton,
  Image,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';

import { MarketTokenItem } from '../../../../store/reducers/market';
import { ListItem } from '../../../Components/stories/List/ListView';
import { ListHeadTagType } from '../../types';
import SparklineChart from '../SparklineChart';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { showMarketCellMoreMenu } from './MarketCellMoreMenu';
import { showHomeMoreMenu } from '../../../Overlay/HomeMoreMenu';
import { useMarketTokenItem } from '../../hooks/useMarketToken';

interface MarketTokenCellProps {
  onPress?: () => void;
  marketTokenId: string;
  headTags: ListHeadTagType[];
}

const MarketTokenSwapEnable = ({
  marketTokenId,
  implChainIds,
}: {
  marketTokenId: string;
  implChainIds?: string[];
}) => {
  useEffect(() => {
    if (!implChainIds) {
      backgroundApiProxy.serviceMarket.fetchTokenSupportImpl(marketTokenId);
    }
  }, [marketTokenId, implChainIds]);

  if (implChainIds) {
    return implChainIds.length > 0 ? (
      <Button
        borderRadius={12}
        type="basic"
        size="xs"
        onPress={() => {
          // TODO 点击Swap 逻辑
        }}
      >
        Swap
      </Button>
    ) : (
      <Box w="55px" h="30px" />
    );
  }
  return <Skeleton shape="Caption" />;
};

const MarketTokenCell: FC<MarketTokenCellProps> = ({
  onPress,
  marketTokenId,
  headTags,
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const marketTokenItem: MarketTokenItem = useMarketTokenItem({
    coingeckoId: marketTokenId,
  });
  return (
    <ListItem
      borderRadius={0}
      onLongPress={() => {
        if (isVerticalLayout && marketTokenItem)
          showMarketCellMoreMenu(marketTokenItem);
      }}
      onPress={onPress}
      key={marketTokenId}
    >
      {headTags.map((tag) => {
        switch (tag.id) {
          case 1: {
            return (
              <ListItem.Column>
                <HStack
                  alignItems="center"
                  justifyContent="center"
                  w={tag.minW}
                >
                  {!marketTokenItem ? (
                    <Skeleton shape="Avatar" size={20} />
                  ) : (
                    <Pressable
                      p={1}
                      rounded="full"
                      _hover={{ bgColor: 'surface-hovered' }}
                      _pressed={{ bgColor: 'surface-pressed' }}
                      onPress={() => {
                        if (marketTokenItem.favorited) {
                          backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
                            marketTokenItem.coingeckoId,
                          );
                        } else {
                          backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens(
                            [marketTokenItem.coingeckoId],
                          );
                        }
                      }}
                    >
                      <Icon
                        name="StarSolid"
                        size={20}
                        color={
                          marketTokenItem.favorited
                            ? 'icon-warning'
                            : 'icon-default'
                        }
                      />
                    </Pressable>
                  )}
                </HStack>
              </ListItem.Column>
            );
          }
          case 2: {
            return (
              <ListItem.Column>
                <HStack alignItems="center" flex={1} space={3}>
                  {marketTokenItem && marketTokenItem.image ? (
                    <Image
                      borderRadius={16}
                      src={marketTokenItem.image}
                      alt={marketTokenItem.image}
                      key={marketTokenItem.image}
                      size={8}
                      fallbackElement={
                        <Icon name="QuestionMarkOutline" size={32} />
                      }
                    />
                  ) : (
                    <Skeleton shape="Avatar" size={32} />
                  )}
                  <Box>
                    {marketTokenItem && marketTokenItem.symbol ? (
                      <Typography.Body2Strong>
                        {marketTokenItem.symbol}
                      </Typography.Body2Strong>
                    ) : (
                      <Skeleton shape="Body2" />
                    )}
                    {marketTokenItem && marketTokenItem.totalVolume ? (
                      <Typography.Body2 color="text-subdued">
                        {isVerticalLayout
                          ? `Vol$${marketTokenItem.totalVolume}`
                          : marketTokenItem.name}
                      </Typography.Body2>
                    ) : (
                      <Skeleton shape="Body2" />
                    )}
                  </Box>
                </HStack>
              </ListItem.Column>
            );
          }
          case 3: {
            return marketTokenItem && marketTokenItem.price ? (
              <ListItem.Column
                text={{
                  label: `$${marketTokenItem.price}`,
                  labelProps: { textAlign: tag.textAlign },
                  size: 'sm',
                }}
                flex={1}
              />
            ) : (
              <ListItem.Column>
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <Skeleton shape="Body2" />
                </Box>
              </ListItem.Column>
            );
          }
          case 4: {
            if (marketTokenItem && marketTokenItem.priceChangePercentage24H) {
              return isVerticalLayout ? (
                <ListItem.Column>
                  <Box flex={1} alignItems="center" justifyContent="flex-end">
                    <Box
                      width="72px"
                      height="32px"
                      borderRadius="6px"
                      backgroundColor={
                        marketTokenItem.priceChangePercentage24H >= 0
                          ? 'surface-success-subdued'
                          : 'surface-critical-subdued'
                      }
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Typography.Body2Strong
                        textAlign="center"
                        color={
                          marketTokenItem.priceChangePercentage24H >= 0
                            ? 'text-success'
                            : 'text-critical'
                        }
                      >{`${marketTokenItem.priceChangePercentage24H.toFixed(
                        2,
                      )}%`}</Typography.Body2Strong>
                    </Box>
                  </Box>
                </ListItem.Column>
              ) : (
                <ListItem.Column
                  text={{
                    label: `${marketTokenItem.priceChangePercentage24H.toFixed(
                      2,
                    )}%`,
                    labelProps: {
                      textAlign: tag.textAlign,
                      color:
                        marketTokenItem.priceChangePercentage24H >= 0
                          ? 'text-success'
                          : 'text-critical',
                    },
                    size: 'sm',
                  }}
                  flex={1}
                />
              );
            }
            return (
              <ListItem.Column
                flex={1}
                alignItems="center"
                justifyContent="flex-end"
              >
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <Skeleton shape="Body2" />
                </Box>
              </ListItem.Column>
            );
          }
          case 5: {
            return marketTokenItem && marketTokenItem.totalVolume ? (
              <ListItem.Column
                text={{
                  label: `$${marketTokenItem.totalVolume}`,
                  labelProps: { textAlign: tag.textAlign },
                  size: 'sm',
                }}
                flex={1}
              />
            ) : (
              <ListItem.Column>
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <Skeleton shape="Body2" />
                </Box>
              </ListItem.Column>
            );
          }
          case 6: {
            return marketTokenItem ? (
              <ListItem.Column
                text={{
                  label: `$${marketTokenItem.marketCap ?? 0}`,
                  labelProps: { textAlign: tag.textAlign },
                  size: 'sm',
                }}
                flex={1}
              />
            ) : (
              <ListItem.Column>
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <Skeleton shape="Body2" />
                </Box>
              </ListItem.Column>
            );
          }
          case 7: {
            return (
              <ListItem.Column>
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  {marketTokenItem && marketTokenItem.sparkline ? (
                    <SparklineChart
                      data={marketTokenItem.sparkline}
                      width={50}
                      height={40}
                      range={20}
                      lineColor={
                        marketTokenItem.priceChangePercentage24H &&
                        marketTokenItem.priceChangePercentage24H >= 0
                          ? '#33C641'
                          : '#FF6259'
                      }
                      linearGradientColor={
                        marketTokenItem.priceChangePercentage24H &&
                        marketTokenItem.priceChangePercentage24H >= 0
                          ? 'rgba(0, 184, 18, 0.2)'
                          : 'rgba(255, 98, 89, 0.2)'
                      }
                    />
                  ) : (
                    <Skeleton shape="Caption" />
                  )}
                </Box>
              </ListItem.Column>
            );
          }
          case 8: {
            return (
              <ListItem.Column>
                <Box flexDirection="row" flex={1}>
                  {marketTokenItem ? (
                    <MarketTokenSwapEnable
                      implChainIds={marketTokenItem.implChainIds}
                      marketTokenId={marketTokenId}
                    />
                  ) : (
                    <Skeleton shape="Caption" />
                  )}
                  <IconButton
                    size="xs"
                    name="DotsVerticalSolid"
                    type="plain"
                    ml="2"
                    circle
                    onPress={() => {
                      showMarketCellMoreMenu(marketTokenItem);
                    }}
                  />
                </Box>
              </ListItem.Column>
            );
          }
          default:
            return null;
        }
      })}
    </ListItem>
  );
};

export default React.memo(MarketTokenCell);
